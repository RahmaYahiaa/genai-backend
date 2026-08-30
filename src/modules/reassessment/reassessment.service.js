import mongoose from 'mongoose';
import {
  CORRECTNESS_LEVELS,
  EVIDENCE_SOURCE_TYPES,
  MASTERY_LEVELS,
} from '../../config/constants.js';
import {
  AiProviderError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { toPublicReassessmentSession } from './reassessment-session.model.js';
// Single definition of the deterministic mastery ladder (shared with the
// learner model) plus the platform-wide LLM output contracts.
import { deriveMasteryLevel } from '../learner/learner-model.service.js';
import { llmAnswerEvaluationSchema } from '../learner/learner-diagnostic.schema.js';
import { llmPracticeQuestionsSchema } from '../practice/practice.schema.js';

const CORRECTNESS_SCORES = {
  [CORRECTNESS_LEVELS.CORRECT]: 1,
  [CORRECTNESS_LEVELS.PARTIAL]: 0.5,
  [CORRECTNESS_LEVELS.INCORRECT]: 0,
};

const MASTERY_RANK = {
  [MASTERY_LEVELS.NO_EVIDENCE]: 0,
  [MASTERY_LEVELS.BEGINNER]: 1,
  [MASTERY_LEVELS.INTERMEDIATE]: 2,
  [MASTERY_LEVELS.ADVANCED]: 3,
  [MASTERY_LEVELS.MASTERED]: 4,
};

const REASSESSMENT_QUESTION_SYSTEM_PROMPT =
  'You are a reassessment engine for an academic learning platform. ' +
  'Generate open-ended questions that let a student re-demonstrate understanding of a topic they previously struggled with. ' +
  'Respond with JSON only, matching exactly: ' +
  '{"questions":[{"prompt":"<question text>","difficulty":"easy|medium|hard"}]}';

/**
 * Reassessment & learning gain (flow steps 17-20). Owner-only, zero ML.
 * A reassessment is only meaningful on a topic that already has evidence
 * (otherwise the diagnostic is the right tool). The mastery level at start
 * is snapshotted; every answered question writes structured learning_evidence
 * (sourceType: "reassessment") that moves the deterministic learner model,
 * and the gain report compares evidence-derived mastery before/after.
 */
export function createReassessmentService({
  coursesService,
  reassessmentRepository,
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

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function averageOf(rows) {
    return rows.length ? round2(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  }

  async function requireOwnedSession(user, courseId, reassessmentId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const session = await reassessmentRepository.findById(reassessmentId);
    if (
      !session ||
      String(session.studentId) !== String(user.id) ||
      String(session.courseId) !== courseDocumentId(course)
    ) {
      throw new NotFoundError('Reassessment session not found');
    }
    return { course, session };
  }

  // --- Start a reassessment (flow step 17) ---

  async function startSession(user, courseId, data) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const topics = getCourseTopics(course);
    const topic = topics.find((item) => item.id === data.topicId);
    if (!topic) {
      throw new ValidationError('topicId must reference a topic of this course');
    }

    const courseDocId = courseDocumentId(course);
    const evidenceRows = (
      await evidenceRepository.listByStudentCourse(user.id, courseDocId)
    ).filter((row) => String(row.topicId) === topic.id);
    if (evidenceRows.length === 0) {
      throw new ValidationError(
        'This topic has no learning evidence yet; run a diagnostic before requesting a reassessment',
      );
    }

    const masteryLevelBefore = deriveMasteryLevel(evidenceRows.length, averageOf(evidenceRows));

    const generated = parseLlmJson(
      await llmProvider.completeJson({
        task: 'generate_reassessment_questions',
        system: REASSESSMENT_QUESTION_SYSTEM_PROMPT,
        user: JSON.stringify({
          courseTitle: course.title,
          topicTitle: topic.title,
          objectives: topic.objectives,
          masteryLevelBefore,
          count: data.questionsCount,
        }),
      }),
      llmPracticeQuestionsSchema,
      'generate_reassessment_questions',
    );

    const questions = generated.questions.slice(0, data.questionsCount).map((question) => ({
      prompt: question.prompt,
      difficulty: question.difficulty,
      generatedBy: llmProvider.model,
    }));
    if (questions.length === 0) {
      throw new AiProviderError('generate_reassessment_questions: AI returned no questions');
    }

    const session = await reassessmentRepository.create({
      studentId: user.id,
      courseId: courseDocId,
      topicId: new mongoose.Types.ObjectId(topic.id),
      masteryLevelBefore,
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
      status: 'in_progress',
      questions,
      answers: [],
      startedAt: new Date(),
    });
    return toPublicReassessmentSession(session);
  }

  async function listSessions(user, courseId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const sessions = await reassessmentRepository.listByStudentCourse(
      user.id,
      courseDocumentId(course),
    );
    return sessions.map(toPublicReassessmentSession);
  }

  async function getSession(user, courseId, reassessmentId) {
    const { session } = await requireOwnedSession(user, courseId, reassessmentId);
    return toPublicReassessmentSession(session);
  }

  // --- Answer a reassessment question (flow steps 18-19) ---

  async function submitAnswer(user, courseId, reassessmentId, data) {
    const { course, session } = await requireOwnedSession(user, courseId, reassessmentId);
    if (session.status !== 'in_progress') {
      throw new ValidationError('This reassessment session is already completed');
    }

    const question = (session.questions ?? []).find((item) => String(item._id) === data.questionId);
    if (!question) {
      throw new NotFoundError('Question not found in this reassessment session');
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
        system:
          'You are an expert grader for an academic learning platform. ' +
          'Grade the student answer against the question and its learning objectives. ' +
          'You classify the answer only; you never compute mastery or final grades. ' +
          'Respond with JSON only, matching exactly: ' +
          '{"correctness":"incorrect|partial|correct","confidence":0.0-1.0,' +
          '"misconceptions":[{"code":"optional short code","description":"<the misconception>"}],' +
          '"feedback":"constructive feedback for the student"}',
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
      sourceType: EVIDENCE_SOURCE_TYPES.REASSESSMENT,
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

    const updated = await reassessmentRepository.pushAnswer(session._id, {
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
    const finalSession = isComplete ? await reassessmentRepository.complete(session._id) : updated;

    return {
      session: toPublicReassessmentSession(finalSession),
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
        evidenceId: evidence._id.toString(),
      },
    };
  }

  // --- Learning gain report (flow step 20, zero ML) ---

  async function getLearningGain(user, courseId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const courseDocId = courseDocumentId(course);
    const topics = getCourseTopics(course);
    const evidenceRows = await evidenceRepository.listByStudentCourse(user.id, courseDocId);
    const sessions = await reassessmentRepository.listByStudentCourse(user.id, courseDocId);

    // Earliest reassessment start per topic = the before/after boundary.
    const firstReassByTopic = new Map();
    for (const session of sessions) {
      const key = String(session.topicId);
      const startedAt = session.startedAt ?? session.createdAt;
      if (!firstReassByTopic.has(key) || startedAt < firstReassByTopic.get(key)) {
        firstReassByTopic.set(key, startedAt);
      }
    }

    const topicGains = topics.map((topic) => {
      const rows = evidenceRows.filter((row) => String(row.topicId) === topic.id);
      const currentLevel = deriveMasteryLevel(rows.length, averageOf(rows));
      const currentAverageScore = averageOf(rows);
      const reassessmentsCount = sessions.filter(
        (session) => String(session.topicId) === topic.id,
      ).length;
      const firstReassAt = firstReassByTopic.get(topic.id);

      // Without a reassessment there is no honest "before": report the
      // current state and mark it explicitly instead of faking a baseline.
      if (!firstReassAt) {
        return {
          topicId: topic.id,
          title: topic.title,
          reassessmentsCount,
          change: 'no_reassessment_yet',
          baselineMasteryLevel: currentLevel,
          baselineAverageScore: currentAverageScore,
          baselineEvidenceCount: rows.length,
          currentMasteryLevel: currentLevel,
          currentAverageScore,
          evidenceCount: rows.length,
        };
      }

      const baselineRows = rows.filter((row) => new Date(row.createdAt) < firstReassAt);
      const baselineMasteryLevel = deriveMasteryLevel(baselineRows.length, averageOf(baselineRows));
      const change =
        MASTERY_RANK[currentLevel] > MASTERY_RANK[baselineMasteryLevel]
          ? 'improved'
          : MASTERY_RANK[currentLevel] < MASTERY_RANK[baselineMasteryLevel]
            ? 'declined'
            : 'unchanged';

      return {
        topicId: topic.id,
        title: topic.title,
        reassessmentsCount,
        change,
        baselineMasteryLevel,
        baselineAverageScore: averageOf(baselineRows),
        baselineEvidenceCount: baselineRows.length,
        currentMasteryLevel: currentLevel,
        currentAverageScore,
        evidenceCount: rows.length,
      };
    });

    const overview = {
      reassessmentsCount: sessions.length,
      reassessedTopicsCount: firstReassByTopic.size,
      improvedTopicsCount: topicGains.filter((gain) => gain.change === 'improved').length,
      unchangedTopicsCount: topicGains.filter((gain) => gain.change === 'unchanged').length,
      declinedTopicsCount: topicGains.filter((gain) => gain.change === 'declined').length,
      currentOverallAverageScore: averageOf(evidenceRows),
    };

    return {
      courseId: courseDocId,
      topics: topicGains,
      overview,
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    startSession,
    listSessions,
    getSession,
    submitAnswer,
    getLearningGain,
  };
}