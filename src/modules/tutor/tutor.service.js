import { GROUNDING_STATUSES } from '../../config/constants.js';
import {
  AiProviderError,
  InsufficientEvidenceError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { toPublicTutorSession } from './tutor-session.model.js';
import { llmTutorAnswerSchema } from './tutor.schema.js';

const TUTOR_SYSTEM_PROMPT =
  'You are a course tutor for an academic learning platform. ' +
  'Answer ONLY from the trusted course material excerpts provided in the input. ' +
  'Every claim must come from those excerpts; if they are not enough, say so. ' +
  'Respond with JSON only, matching exactly: ' +
  '{"answer":"<your grounded explanation>","usedChunkIds":["<ids of the excerpts you actually used>"]}';

/**
 * AI Tutor (flow steps 11-13). Owner-only. The deterministic retrieval gate
 * runs BEFORE the LLM: with no sufficiently-matching trusted material the
 * request fails with 422 INSUFFICIENT_EVIDENCE and no answer is generated.
 * Answers are enforced to cite chunks we actually provided (invalid citation
 * ids are stripped; zero valid citations aborts), so grounding is structural,
 * not prompt-hoping. The tutor never writes mastery or grades.
 */
export function createTutorService({
  coursesService,
  retrievalService,
  tutorSessionRepository,
  llmProvider,
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
    }));
  }

  function courseDocumentId(course) {
    return course.id ?? String(course._id);
  }

  async function requireOwnedSession(user, courseId, tutorSessionId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const session = await tutorSessionRepository.findById(tutorSessionId);
    if (
      !session ||
      String(session.studentId) !== String(user.id) ||
      String(session.courseId) !== courseDocumentId(course)
    ) {
      throw new NotFoundError('Tutor session not found');
    }
    return { course, session };
  }

  // --- Tutor sessions (flow step 11) ---

  async function createSession(user, courseId, data) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const topics = getCourseTopics(course);
    const topic = topics.find((item) => item.id === data.topicId);
    if (!topic) {
      throw new ValidationError('topicId must reference a topic of this course');
    }

    const session = await tutorSessionRepository.create({
      studentId: user.id,
      courseId: courseDocumentId(course),
      topicId: data.topicId,
      mode: data.mode,
      status: 'active',
      messages: [],
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
    });
    return toPublicTutorSession(session);
  }

  async function listSessions(user, courseId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const sessions = await tutorSessionRepository.listByStudentCourse(
      user.id,
      courseDocumentId(course),
    );
    return sessions.map(toPublicTutorSession);
  }

  async function getSession(user, courseId, tutorSessionId) {
    const { session } = await requireOwnedSession(user, courseId, tutorSessionId);
    return toPublicTutorSession(session);
  }

  // --- Ask a grounded question (flow steps 12-13) ---

  async function askQuestion(user, courseId, tutorSessionId, data) {
    const { course, session } = await requireOwnedSession(user, courseId, tutorSessionId);
    if (session.status !== 'active') {
      throw new ValidationError('This tutor session is closed');
    }

    const topics = getCourseTopics(course);
    const topic = topics.find((item) => item.id === session.topicId.toString());
    const topicTitle = topic?.title ?? 'Unknown topic';

    // Trusted retrieval first (RAG): courseId filter is applied inside the
    // vector search, chunks below the relevance floor are dropped.
    const { contexts } = await retrievalService.retrieveContext({
      courseId: courseDocumentId(course),
      query: data.content,
    });

    // The student question is always recorded, even when we refuse to answer.
    await tutorSessionRepository.pushMessage(session._id, {
      role: 'student',
      content: data.content,
      citations: [],
      grounding: null,
    });

    if (contexts.length === 0) {
      throw new InsufficientEvidenceError(
        `No trusted material in this course matches the question closely enough to answer safely`,
      );
    }

    const generated = parseLlmJson(
      await llmProvider.completeJson({
        task: 'answer_tutor_question',
        system: TUTOR_SYSTEM_PROMPT,
        user: JSON.stringify({
          topicTitle,
          mode: session.mode,
          question: data.content,
          contexts: contexts.map((context) => ({
            id: context.chunkId,
            text: context.text,
            score: context.score,
          })),
        }),
      }),
      llmTutorAnswerSchema,
      'answer_tutor_question',
    );

    // Citation enforcement: only chunks we actually provided count.
    const provided = new Map(contexts.map((context) => [context.chunkId, context]));
    const citations = (generated.usedChunkIds ?? [])
      .map((chunkId) => provided.get(chunkId))
      .filter(Boolean)
      .map((context) => ({
        chunkId: context.chunkId,
        materialId: context.materialId,
        order: context.order,
        score: context.score,
        snippet: context.snippet,
      }));
    if (citations.length === 0) {
      throw new AiProviderError(
        'answer_tutor_question: AI answer was not grounded in trusted material',
      );
    }

    const updated = await tutorSessionRepository.pushMessage(session._id, {
      role: 'tutor',
      content: generated.answer,
      citations,
      grounding: GROUNDING_STATUSES.GROUNDED,
    });

    const message = updated.messages[updated.messages.length - 1];
    return {
      sessionId: updated._id.toString(),
      message: {
        id: message._id.toString(),
        role: message.role,
        content: message.content,
        grounding: message.grounding ?? null,
        citations: (message.citations ?? []).map((citation) => ({
          chunkId: citation.chunkId.toString(),
          materialId: citation.materialId.toString(),
          order: citation.order,
          score: citation.score,
          snippet: citation.snippet,
        })),
        createdAt: message.createdAt,
      },
    };
  }

  return { createSession, listSessions, getSession, askQuestion };
}