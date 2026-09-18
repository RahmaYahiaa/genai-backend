import { GRADING_PROMPT_VERSION, SUBMISSION_STATUS, AI_CONFIDENCE } from '../../config/constants.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { llmGradingOutputSchema } from './grading.schema.js';
import { toPublicAiEvaluation } from './ai-evaluation.model.js';
import { logger } from '../../config/logger.js';
import { toPublicSubmission } from '../submissions/submission.model.js';

const FALLBACK_MODEL_VERSION = 'rules-v1-fallback';

function buildSources(question, contexts) {
  return {
    question: true,
    model_answer: Boolean(question.modelAnswer),
    rubric: Boolean(question.rubricText),
    retrievedChunks: contexts.length,
    chunkIds: contexts.map((context) => context.chunkId),
  };
}

function insufficientEvaluation(sources, reason) {
  return {
    score: null,
    correctness: null,
    confidence: AI_CONFIDENCE.INSUFFICIENT_EVIDENCE,
    feedbackText:
      'Grading was deferred to mandatory manual review: no trusted source (model answer, rubric, or course material) was available to evaluate this answer.',
    misconceptions: [],
    rubricBreakdown: null,
    sourcesUsed: { ...sources, reason },
    modelVersion: FALLBACK_MODEL_VERSION,
    promptVersion: GRADING_PROMPT_VERSION,
  };
}

export function createGradingService({
  coursesService,
  aiEvaluationRepository,
  assignmentRepository,
  assignmentQuestionRepository,
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  courseRepository,
  retrievalService,
  llmProvider,
}) {
  async function collectSources(courseId, question) {
    if (question.modelAnswer && question.rubricText) {
      return { sources: buildSources(question, []), contexts: [] };
    }
    const { contexts } = await retrievalService.retrieveContext({
      courseId,
      query: question.questionText,
    });
    return { sources: buildSources(question, contexts), contexts };
  }

  const GRADING_SYSTEM_PROMPT =
    'You are an academic grading assistant. Grade the student answer against the provided ' +
    'model answer, rubric and trusted course excerpts only. Respond with JSON only using this shape: ' +
    '{"score": number between 0 and maxScore, "correctness": "CORRECT"|"PARTIAL"|"INCORRECT", ' +
    '"confidence": "HIGH"|"MEDIUM"|"LOW", "feedbackText": string, ' +
    '"misconceptions": [{"code": string, "description": string}], "rubricBreakdown": object or null}.';

  async function runModel({ question, contexts, answerText, topicTitle }) {
    const payload = {
      questionText: question.questionText,
      maxScore: question.maxScore,
      modelAnswer: question.modelAnswer ?? null,
      rubricText: question.rubricText ?? null,
      hasModelAnswer: Boolean(question.modelAnswer),
      hasRubric: Boolean(question.rubricText),
      topicTitle,
      excerpts: contexts.map((context) => ({ id: context.chunkId, text: context.snippet })),
      answerText,
    };
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        // Rate-limited providers need a beat between attempts.
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      try {
        const raw = await llmProvider.completeJson({
          task: 'grade_assignment_answer',
          system: GRADING_SYSTEM_PROMPT,
          user: JSON.stringify(payload),
          payload,
        });
        return llmGradingOutputSchema.parse(raw);
      } catch (error) {
        lastError = error;
        logger.warn(`LLM grading attempt ${attempt + 1} failed: ${error?.message ?? 'unknown error'}`);
      }
    }
    throw lastError ?? new Error('grading model output failed twice');
  }

  async function gradeAnswerCore({ courseId, topicTitle, question, answerText }) {
    const { sources, contexts } = await collectSources(courseId, question);
    if (!sources.model_answer && !sources.rubric && contexts.length === 0) {
      return insufficientEvaluation(sources, 'NO_SOURCE_AVAILABLE');
    }

    let output;
    try {
      output = await runModel({ question, contexts, answerText, topicTitle });
    } catch {
      return insufficientEvaluation(sources, 'INVALID_MODEL_OUTPUT');
    }

    const score = Math.round(Math.min(Math.max(output.score, 0), question.maxScore) * 100) / 100;
    return {
      score,
      correctness: output.correctness,
      confidence: output.confidence,
      feedbackText: output.feedbackText,
      misconceptions: output.misconceptions,
      rubricBreakdown: output.rubricBreakdown ?? null,
      sourcesUsed: sources,
      modelVersion: llmProvider.model,
      promptVersion: GRADING_PROMPT_VERSION,
    };
  }

  function toPublicShape(evaluation) {
    return {
      score: evaluation.score,
      correctness: evaluation.correctness,
      confidence: evaluation.confidence,
      feedbackText: evaluation.feedbackText,
      misconceptions: evaluation.misconceptions,
      rubricBreakdown: evaluation.rubricBreakdown,
      sourcesUsed: evaluation.sourcesUsed,
      modelVersion: evaluation.modelVersion,
      promptVersion: evaluation.promptVersion,
    };
  }

  async function previewForInstructor(user, assignmentId, questionId, payload) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    await coursesService.ensureInstructorCourseAccess(user, assignment.courseId.toString());
    const question = await assignmentQuestionRepository.findById(questionId);
    if (!question || String(question.assignmentId) !== String(assignment._id)) {
      throw new NotFoundError('Question not found');
    }
    const course = await courseRepository.findById(assignment.courseId);
    const topicTitle =
      (course?.topics ?? []).find((t) => String(t._id) === String(question.topicId))?.title ?? '';
    const evaluation = await gradeAnswerCore({
      courseId: assignment.courseId,
      topicTitle,
      question,
      answerText: payload.trialAnswer,
    });
    return toPublicShape(evaluation);
  }

  async function gradeAttemptAnswers(submissionId) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) return;
    await submissionRepository.updateById(submissionId, { status: SUBMISSION_STATUS.GRADING });

    const attempt = await submissionAttemptRepository.findLatest(submissionId);
    if (!attempt) {
      await submissionRepository.updateById(submissionId, { status: SUBMISSION_STATUS.GRADED });
      return;
    }

    const assignment = await assignmentRepository.findById(submission.assignmentId);
    const answers = await submissionAnswerRepository.listByAttempt(attempt._id);
    const questions = await assignmentQuestionRepository.listByAssignment(submission.assignmentId);
    const course = await courseRepository.findById(assignment.courseId);

    for (const answer of answers) {
      const existing = await aiEvaluationRepository.findByAnswerId(answer._id);
      if (existing) continue;
      const question = questions.find((q) => String(q._id) === String(answer.questionId));
      if (!question) continue;
      const topicTitle =
        (course?.topics ?? []).find((t) => String(t._id) === String(question.topicId))?.title ?? '';
      let evaluation;
      try {
        evaluation = await gradeAnswerCore({
          courseId: assignment.courseId,
          topicTitle,
          question,
          answerText: answer.answerText ?? '',
        });
      } catch {
        evaluation = insufficientEvaluation(
          { question: true, model_answer: false, rubric: false, retrievedChunks: 0, chunkIds: [] },
          'GRADING_ERROR',
        );
      }
      await aiEvaluationRepository.create({
        answerId: answer._id,
        attemptId: attempt._id,
        submissionId,
        assignmentId: submission.assignmentId,
        questionId: question._id,
        courseId: assignment.courseId,
        studentId: submission.studentId,
        topicId: question.topicId,
        ...evaluation,
      });
    }

    await submissionRepository.updateById(submissionId, { status: SUBMISSION_STATUS.GRADED });
  }

  async function getSubmissionDetail(user, submissionId) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }
    const assignment = await assignmentRepository.findById(submission.assignmentId);
    if (!assignment) {
      throw new NotFoundError('Submission not found');
    }
    await coursesService.ensureInstructorCourseAccess(user, assignment.courseId.toString());

    const questions = await assignmentQuestionRepository.listByAssignment(assignment._id);
    const attempts = await submissionAttemptRepository.listBySubmission(submission._id);
    const latest = attempts[attempts.length - 1] ?? null;
    const answers = latest ? await submissionAnswerRepository.listByAttempt(latest._id) : [];
    const evaluations = await aiEvaluationRepository.listBySubmission(submission._id);
    const evaluationByAnswer = new Map(
      evaluations.map((evaluation) => [String(evaluation.answerId), toPublicAiEvaluation(evaluation)]),
    );

    return {
      submission: toPublicSubmission(submission),
      assignment: {
        id: assignment._id.toString(),
        title: assignment.title,
        status: assignment.status,
      },
      attempts: attempts.map((attempt) => ({
        id: attempt._id.toString(),
        attemptNo: attempt.attemptNo,
        submittedAt: attempt.submittedAt ?? null,
      })),
      answers: answers.map((answer) => {
        const question = questions.find((q) => String(q._id) === String(answer.questionId));
        return {
          id: answer._id.toString(),
          questionId: answer.questionId.toString(),
          answerText: answer.answerText ?? null,
          imageUrl: answer.imageUrl ?? null,
          savedAt: answer.savedAt ?? null,
          question: question
            ? {
                id: question._id.toString(),
                orderIndex: question.orderIndex,
                questionText: question.questionText,
                topicId: question.topicId.toString(),
                maxScore: question.maxScore,
                questionType: question.questionType ?? 'essay',
                options: (question.options ?? []).map((option) => ({ id: option.id, text: option.text })),
                modelAnswer: question.modelAnswer ?? null,
                rubricText: question.rubricText ?? null,
              }
            : null,
          selectedOptionIds: answer.selectedOptionIds ?? null,
          evaluation: evaluationByAnswer.get(String(answer._id)) ?? null,
        };
      }),
    };
  }

  return { gradeAnswerCore, gradeAttemptAnswers, previewForInstructor, getSubmissionDetail };
}