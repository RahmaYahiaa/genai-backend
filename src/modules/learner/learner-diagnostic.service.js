import mongoose from 'mongoose';
import { CORRECTNESS_LEVELS, EVIDENCE_SOURCE_TYPES } from '../../config/constants.js';
import {
  AiProviderError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { toPublicLearnerProfile } from './learner-profile.model.js';
import { toPublicDiagnostic } from './diagnostic-assessment.model.js';
import { toPublicEvidence } from './learning-evidence.model.js';
import {
  llmAnswerEvaluationSchema,
  llmGeneratedQuestionsSchema,
} from './learner-diagnostic.schema.js';

const CORRECTNESS_SCORES = {
  [CORRECTNESS_LEVELS.CORRECT]: 1,
  [CORRECTNESS_LEVELS.PARTIAL]: 0.5,
  [CORRECTNESS_LEVELS.INCORRECT]: 0,
};

const QUESTION_GENERATION_SYSTEM_PROMPT =
  'You are an assessment engine for an academic learning platform. ' +
  'Generate open-ended diagnostic questions that reveal what a student actually understands. ' +
  'Respond with JSON only, matching exactly: ' +
  '{"questions":[{"topicId":"<topic id from input>","objectiveCode":"<code or null>","prompt":"<question text>","difficulty":"easy|medium|hard"}]}';

const ANSWER_EVALUATION_SYSTEM_PROMPT =
  'You are an expert grader for an academic learning platform. ' +
  'Grade the student answer against the question and its learning objectives. ' +
  'You classify the answer only; you never compute mastery or final grades. ' +
  'Respond with JSON only, matching exactly: ' +
  '{"correctness":"incorrect|partial|correct","confidence":0.0-1.0,' +
  '"misconceptions":[{"code":"optional short code","description":"<the misconception>"}],' +
  '"feedback":"<constructive feedback for the student>"}';

/**
 * Learning flow (diagnostics -> evidence). Owner-only: the student themself.
 * Every LLM output is Zod-validated; scores are derived deterministically;
 * structured evidence lives in its own collection, generated feedback text
 * stays on the assessment.
 */
export function createLearnerDiagnosticService({
  learnerRepository,
  diagnosticRepository,
  evidenceRepository,
  coursesService,
  llmProvider,
  transcriptionProvider,
}) {
  function parseLlmJson(raw, schema, taskName) {
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new AiProviderError(`${taskName}: AI provider returned invalid output`);
    }
    return result.data;
  }

  // course topics arrive from coursesService as lean documents: subdocuments
  // expose `_id` there (the `id` virtual does not survive .lean()), so
  // normalize both shapes to a string id.
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

  async function touchProfile(user, course) {
    return learnerRepository.upsertForCourse({
      studentId: user.id,
      courseId: courseDocumentId(course),
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
    });
  }

  function courseDocumentId(course) {
    return course.id ?? String(course._id);
  }

  // --- Learner profile (flow step 4) ---

  async function getOrCreateLearnerProfile(user, courseId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const profile = await learnerRepository.upsertForCourse({
      studentId: user.id,
      courseId: courseDocumentId(course),
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
    });
    return toPublicLearnerProfile(profile);
  }

  // --- Diagnostics (flow steps 5-6) ---

  async function startDiagnostic(user, courseId, { topicIds, questionsPerTopic }) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const topics = getCourseTopics(course);
    if (topics.length === 0) {
      throw new ValidationError(
        'This course has no topics yet; add topics before running a diagnostic',
      );
    }

    let targetTopics = topics;
    if (topicIds) {
      const available = new Set(topics.map((topic) => topic.id));
      for (const topicId of topicIds) {
        if (!available.has(topicId)) {
          throw new ValidationError('topicIds must reference topics of this course');
        }
      }
      targetTopics = topics.filter((topic) => topicIds.includes(topic.id));
    }

    const generated = parseLlmJson(
      await llmProvider.completeJson({
        task: 'generate_diagnostic_questions',
        system: QUESTION_GENERATION_SYSTEM_PROMPT,
        user: JSON.stringify({
          courseTitle: course.title,
          questionsPerTopic,
          topics: targetTopics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            objectives: topic.objectives,
          })),
        }),
      }),
      llmGeneratedQuestionsSchema,
      'generate_diagnostic_questions',
    );

    const topicById = new Map(targetTopics.map((topic) => [topic.id, topic]));
    const validObjectives = new Map(
      targetTopics.flatMap((topic) =>
        topic.objectives.map((objective) => [`${topic.id}:${objective.code}`, objective.code]),
      ),
    );

    const questions = generated.questions.map((question) => {
      const topic = topicById.get(question.topicId);
      if (!topic) {
        throw new AiProviderError('generate_diagnostic_questions: AI referenced an unknown topic');
      }
      let objectiveCode = null;
      if (question.objectiveCode) {
        objectiveCode = validObjectives.get(`${topic.id}:${question.objectiveCode}`) ?? null;
      }
      return {
        topicId: new mongoose.Types.ObjectId(topic.id),
        objectiveCode,
        prompt: question.prompt,
        difficulty: question.difficulty,
        generatedBy: llmProvider.model,
      };
    });

    const assessment = await diagnosticRepository.create({
      studentId: user.id,
      courseId: courseDocumentId(course),
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
      status: 'in_progress',
      targetTopicIds: targetTopics.map((topic) => new mongoose.Types.ObjectId(topic.id)),
      questions,
      answers: [],
      startedAt: new Date(),
    });

    await touchProfile(user, course);
    return toPublicDiagnostic(assessment);
  }

  async function requireOwnedAssessment(user, courseId, diagnosticId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const assessment = await diagnosticRepository.findById(diagnosticId);
    if (
      !assessment ||
      String(assessment.studentId) !== String(user.id) ||
      String(assessment.courseId) !== courseDocumentId(course)
    ) {
      throw new NotFoundError('Diagnostic assessment not found');
    }
    return { course, assessment };
  }

  async function getDiagnostic(user, courseId, diagnosticId) {
    const { assessment } = await requireOwnedAssessment(user, courseId, diagnosticId);
    return toPublicDiagnostic(assessment);
  }

  async function submitAnswer(user, courseId, diagnosticId, data) {
    const { course, assessment } = await requireOwnedAssessment(user, courseId, diagnosticId);
    if (assessment.status !== 'in_progress') {
      throw new ValidationError('This assessment is already completed');
    }

    const question = (assessment.questions ?? []).find(
      (item) => String(item._id) === data.questionId,
    );
    if (!question) {
      throw new NotFoundError('Question not found in this assessment');
    }
    const alreadyAnswered = (assessment.answers ?? []).some(
      (answer) => String(answer.questionId) === data.questionId,
    );
    if (alreadyAnswered) {
      throw new ForbiddenError('This question has already been answered');
    }

    let responseText = data.content;
    let transcript = null;
    let transcriptModel = null;
    if (data.responseMode === 'voice') {
      if (!data.audioBase64) {
        throw new ValidationError('audioBase64 is required for voice answers');
      }
      const transcription = await transcriptionProvider.transcribe({
        audioBase64: data.audioBase64,
        mimeType: data.audioMimeType,
      });
      transcript = transcription.text;
      transcriptModel = transcription.model;
      responseText = transcription.text;
    }

    const topics = getCourseTopics(course);
    const topic = topics.find((item) => item.id === question.topicId.toString());

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
          answerText: responseText,
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
      topicId: question.topicId,
      objectiveCode: question.objectiveCode ?? null,
      sourceType: EVIDENCE_SOURCE_TYPES.DIAGNOSTIC,
      assessmentId: assessment._id,
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

    const updated = await diagnosticRepository.pushAnswer(assessment._id, {
      questionId: question._id,
      responseMode: data.responseMode,
      responseText,
      transcript,
      transcriptModel,
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
    const finalAssessment = isComplete
      ? await diagnosticRepository.complete(assessment._id)
      : updated;

    await touchProfile(user, course);

    return {
      assessment: toPublicDiagnostic(finalAssessment),
      answer: {
        questionId: data.questionId,
        responseMode: data.responseMode,
        transcript,
        evaluation: {
          correctness: evaluation.correctness,
          score,
          confidence: evaluation.confidence ?? null,
          misconceptions: evaluation.misconceptions ?? [],
          feedback: evaluation.feedback,
          model: llmProvider.model,
        },
        evidenceId: evidence._id.toString(),
      },
    };
  }

  async function listAssessmentEvidence(user, courseId, diagnosticId) {
    const { assessment } = await requireOwnedAssessment(user, courseId, diagnosticId);
    const evidenceRows = await evidenceRepository.listByAssessment(assessment._id);
    return evidenceRows.map(toPublicEvidence);
  }

  return {
    getOrCreateLearnerProfile,
    startDiagnostic,
    getDiagnostic,
    submitAnswer,
    listAssessmentEvidence,
  };
}