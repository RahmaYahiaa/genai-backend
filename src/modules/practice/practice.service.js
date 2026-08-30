import mongoose from 'mongoose';
import { CORRECTNESS_LEVELS, EVIDENCE_SOURCE_TYPES } from '../../config/constants.js';
import {
  AiProviderError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { toPublicPracticeSession } from './practice-session.model.js';
import { toPublicEvidence } from '../learner/learning-evidence.model.js';
// The answer-evaluation contract is the platform-wide one (identical to
// diagnostics) - imported from the learner module instead of duplicated.
import { llmAnswerEvaluationSchema } from '../learner/learner-diagnostic.schema.js';
import { llmPracticeQuestionsSchema } from './practice.schema.js';

const CORRECTNESS_SCORES = {
  [CORRECTNESS_LEVELS.CORRECT]: 1,
  [CORRECTNESS_LEVELS.PARTIAL]: 0.5,
  [CORRECTNESS_LEVELS.INCORRECT]: 0,
};

const PRACTICE_QUESTION_SYSTEM_PROMPT =
  'You are a practice-question generator for an academic learning platform. ' +
  'Generate open-ended practice questions that let a student actively apply the topic. ' +
  'Respond with JSON only, matching exactly: ' +
  '{"questions":[{"prompt":"<question text>","difficulty":"easy|medium|hard"}]}';

// The evaluation contract is identical to diagnostics (grade, never score).
const ANSWER_EVALUATION_SYSTEM_PROMPT =
  'You are an expert grader for an academic learning platform. ' +
  'Grade the student answer against the question and its learning objectives. ' +
  'You classify the answer only; you never compute mastery or final grades. ' +
  'Respond with JSON only, matching exactly: ' +
  '{"correctness":"incorrect|partial|correct","confidence":0.0-1.0,' +
  '"misconceptions":[{"code":"optional short code","description":"<the misconception>"}],' +
  '"feedback":"constructive feedback for the student"}';

/**
 * Practice loop (flow steps 14-16). Owner-only. AI generates questions and
 * classifies answers; scores are derived deterministically; every answered
 * question immediately writes a structured learning_evidence row
 * (sourceType: "practice") that feeds the deterministic learner model.
 */
export function createPracticeService({
  coursesService,
  practiceRepository,
  evidenceRepository,
  llmProvider,
}) {
  function parseLlmJson(raw, schema, taskName) {
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new AiProviderError(`${taskName}: AI provider returned invalid output`);
    }
    return result.data;
  }

  function getCourseTopics(course) {
    return (course.topics ?? []).map((topic) => ({
      id: topic.id ?? String(topic._id),
      title: topic.title,
      objectives: (topic.learningObjectives ?? []).map((objective) => ({
        code: objective.code,
        description: objective.description,
      })),
    }));
  }

  function courseDocumentId(course) {
    return course.id ?? String(course._id);
  }

  async function requireOwnedSession(user, courseId, practiceSessionId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const session = await practiceRepository.findById(practiceSessionId);
    if (
      !session ||
      String(session.studentId) !== String(user.id) ||
      String(session.courseId) !== courseDocumentId(course)
    ) {
      throw new NotFoundError('Practice session not found');
    }
    return { course, session };
  }

  // --- Start a practice session (flow step 14) ---

  async function startSession(user, courseId, data) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const topics = getCourseTopics(course);
    const topic = topics.find((item) => item.id === data.topicId);
    if (!topic) {
      throw new ValidationError('topicId must reference a topic of this course');
    }

    const generated = parseLlmJson(
      await llmProvider.completeJson({
        task: 'generate_practice_questions',
        system: PRACTICE_QUESTION_SYSTEM_PROMPT,
        user: JSON.stringify({
          courseTitle: course.title,
          topicTitle: topic.title,
          objectives: topic.objectives,
          count: data.questionsCount,
        }),
      }),
      llmPracticeQuestionsSchema,
      'generate_practice_questions',
    );

    const questions = generated.questions.slice(0, data.questionsCount).map((question) => ({
      prompt: question.prompt,
      difficulty: question.difficulty,
      generatedBy: llmProvider.model,
    }));
    if (questions.length === 0) {
      throw new AiProviderError('generate_practice_questions: AI returned no questions');
    }

    const session = await practiceRepository.create({
      studentId: user.id,
      courseId: courseDocumentId(course),
      topicId: new mongoose.Types.ObjectId(topic.id),
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
      status: 'in_progress',
      questions,
      answers: [],
      startedAt: new Date(),
    });
    return toPublicPracticeSession(session);
  }

  async function getSession(user, courseId, practiceSessionId) {
    const { session } = await requireOwnedSession(user, courseId, practiceSessionId);
    return toPublicPracticeSession(session);
  }

  // --- Answer a practice question (flow steps 15-16) ---

  async function submitAnswer(user, courseId, practiceSessionId, data) {
    const { course, session } = await requireOwnedSession(user, courseId, practiceSessionId);
    if (session.status !== 'in_progress') {
      throw new ValidationError('This practice session is already completed');
    }

    const question = (session.questions ?? []).find((item) => String(item._id) === data.questionId);
    if (!question) {
      throw new NotFoundError('Question not found in this practice session');
    }
    const alreadyAnswered = (session.answers ?? []).some(
      (answer) => String(answer.questionId) === data.questionId,
    );
    if (alreadyAnswered) {
      throw new ForbiddenError('This question has already been answered');
    }

    const topics = getCourseTopics(course);
    const topic = topics.find((item) => item.id === session.topicId.toString());

    const evaluation = parseLlmJson(
      await llmProvider.completeJson({
        task: 'evaluate_answer',
        system: ANSWER_EVALUATION_SYSTEM_PROMPT,
        user: JSON.stringify({
          courseTitle: course.title,
          topicTitle: topic?.title ?? 'Unknown topic',
          objectives: topic?.objectives ?? [],
          questionPrompt: question.prompt,
          difficulty: question.difficulty,
          answerText: data.content,
        }),
      }),
      llmAnswerEvaluationSchema,
      'evaluate_answer',
    );

    // Deterministic score derivation - the LLM never outputs this number.
    const score = CORRECTNESS_SCORES[evaluation.correctness];

    const evidence = await evidenceRepository.create({
      studentId: user.id,
      courseId: courseDocumentId(course),
      topicId: session.topicId,
      objectiveCode: null,
      sourceType: EVIDENCE_SOURCE_TYPES.PRACTICE,
      assessmentId: session._id,
      questionId: question._id,
      correctness: evaluation.correctness,
      score,
      misconceptionCodes: (evaluation.misconceptions ?? [])
        .map((misconception) => misconception.code ?? null)
        .filter(Boolean),
      evaluationModel: llmProvider.model,
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
    });

    const updated = await practiceRepository.pushAnswer(session._id, {
      questionId: question._id,
      responseText: data.content,
      evaluation: {
        correctness: evaluation.correctness,
        score,
        confidence: evaluation.confidence ?? null,
        misconceptions: evaluation.misconceptions ?? [],
        feedback: evaluation.feedback,
        model: llmProvider.model,
        evaluatedAt: new Date(),
      },
      evidenceId: evidence._id,
      answeredAt: new Date(),
    });

    const isComplete = (updated.answers ?? []).length >= (updated.questions ?? []).length;
    const finalSession = isComplete ? await practiceRepository.complete(session._id) : updated;

    return {
      session: toPublicPracticeSession(finalSession),
      answer: {
        questionId: data.questionId,
        evaluation: {
          correctness: evaluation.correctness,
          score,
          confidence: evaluation.confidence ?? null,
          misconceptions: evaluation.misconceptions ?? [],
          feedback: evaluation.feedback,
          model: llmProvider.model,
        },
        evidence: toPublicEvidence(evidence),
      },
    };
  }

  return { startSession, getSession, submitAnswer };
}