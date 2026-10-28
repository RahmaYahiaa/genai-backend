import { NotFoundError, ForbiddenError } from '../../shared/errors/index.js';

const STATUS_TTL_MS = 30_000;

/**
 * Business rules for the voice bridge. Course access is decided by the
 * courses module (personal courses stay private to their owner). The voice
 * service never receives anything a student could not already see.
 */
export function createVoiceService({
  client,
  voiceSessionModel,
  tutorSessionRepository,
  tutorSessionModel,
  coursesService,
  retrievalService,
  wsBaseUrl,
  now = () => Date.now(),
}) {
  let statusCache = null;

  async function status() {
    if (statusCache && now() - statusCache.at < STATUS_TTL_MS) return statusCache.value;
    let value;
    try {
      const health = await client.health();
      value = { realtimeVoice: health?.status === 'ok' };
    } catch {
      value = { realtimeVoice: false };
    }
    statusCache = { at: now(), value };
    return value;
  }

  function websocketUrl(sessionId) {
    return `${wsBaseUrl}/voice/session/${encodeURIComponent(sessionId)}/audio`;
  }

  async function resolveTopicTitle(course, topicId) {
    if (!topicId) return null;
    const topic = (course.topics ?? []).find((item) => item.id === topicId);
    if (!topic) throw new NotFoundError('Topic not found');
    return topic.title;
  }

  async function mintFor(sessionId) {
    const minted = await client.mintToken(sessionId);
    return { token: minted.token, expiresIn: minted.expires_in ?? 900 };
  }

  async function startSession(user, { courseId, topicId = null, lessonId = null, resume = false }) {
    const course = await coursesService.getCourse(user, courseId);
    const topicTitle = await resolveTopicTitle(course, topicId);
    const topic = topicTitle ?? course.title;

    if (resume) {
      const previous = await voiceSessionModel
        .findOne({ studentId: user.id, courseId, topic })
        .sort({ createdAt: -1 })
        .lean();
      if (previous) {
        try {
          const minted = await mintFor(previous.sessionId);
          return { sessionId: previous.sessionId, wsUrl: websocketUrl(previous.sessionId), topic, resumed: true, ...minted };
        } catch {
          // The voice service no longer knows this session (for example after a restart). Open a new one.
        }
      }
    }

    // The tutor follows the student's profile AI language.
    const language = user.aiLanguage || 'en';
    const created = await client.createSession({
      student_id: String(user.id),
      language,
      course_id: String(courseId),
      ...(lessonId ? { lesson_id: lessonId } : {}),
      topic,
    });

    const sessionId = created.session_id;
    await voiceSessionModel.create({ sessionId, studentId: user.id, courseId, lessonId, topicId, topic, language });

    const minted = await mintFor(sessionId);
    return { sessionId, wsUrl: websocketUrl(sessionId), topic, resumed: false, ...minted };
  }

  async function mintTokenFor(user, sessionId) {
    const record = await voiceSessionModel.findOne({ sessionId }).lean();
    if (!record) throw new NotFoundError('Voice session not found');
    if (String(record.studentId) !== String(user.id)) {
      throw new ForbiddenError('This voice session belongs to another student');
    }
    return { sessionId, wsUrl: websocketUrl(sessionId), ...(await mintFor(sessionId)) };
  }

  async function latestFor(user, courseId) {
    await coursesService.getCourse(user, courseId);
    const record = await voiceSessionModel.findOne({ studentId: user.id, courseId }).sort({ createdAt: -1 }).lean();
    if (!record) return null;
    return { sessionId: record.sessionId, topic: record.topic, createdAt: record.createdAt };
  }

  /**
   * Grounding for the voice tutor (LernaVoice "http" integration mode). Only
   * answers for a student who has a voice session on this course, and only
   * from that course's material chunks.
   */
  async function retrieveEvidence({ studentId, courseId, message, documentIds = null, topK = 6 }) {
    const owned = await voiceSessionModel.exists({ studentId, courseId });
    if (!owned) throw new ForbiddenError('No voice session for this course');

    const { contexts } = await retrievalService.retrieveContext({
      courseId,
      query: message,
      topK,
      materialIds: documentIds?.length ? documentIds : null,
    });

    return {
      query: message,
      available: true,
      sufficient: contexts.length > 0,
      note: contexts.length > 0 ? '' : 'no matching course material',
      evidence: contexts.map((context) => ({
        chunk_id: String(context.chunkId),
        text: context.text,
        source: 'course material',
        score: context.score,
        trust_score: context.score,
        source_type: 'course_material',
        source_url: null,
        page: null,
      })),
    };
  }

  /**
   * Saves a finished (or paused) voice lesson into the student's tutor chat
   * history, so it appears with the written chats. Messages are stored as
   * given: no LLM call, no citations. Saving again replaces the messages of
   * the same entry.
   */
  async function saveTranscript(user, sessionId, turns) {
    const record = await voiceSessionModel.findOne({ sessionId }).lean();
    if (!record) throw new NotFoundError('Voice session not found');
    if (String(record.studentId) !== String(user.id)) {
      throw new ForbiddenError('This voice session belongs to another student');
    }
    const course = await coursesService.ensureStudentCourseAccess(user, record.courseId);

    const messages = turns
      .map((turn) => ({ role: turn.role, content: String(turn.text ?? '').trim().slice(0, 8000) }))
      .filter((message) => message.content.length > 0);
    if (messages.length === 0) return { tutorSessionId: record.tutorSessionId ? String(record.tutorSessionId) : null, messageCount: 0 };

    if (record.tutorSessionId) {
      await tutorSessionModel.updateOne({ _id: record.tutorSessionId }, { $set: { messages } });
      return { tutorSessionId: String(record.tutorSessionId), messageCount: messages.length };
    }

    const created = await tutorSessionRepository.create({
      studentId: user.id,
      courseId: record.courseId,
      topicId: record.topicId ?? null,
      mode: 'explanation',
      status: 'active',
      messages,
      // The lesson's topic is the title. Without it, the history list falls back to the first
      // student turn, which is often a spoken fragment or a typed "continue".
      title: record.topic ? String(record.topic).trim().slice(0, 120) || null : null,
      institutionId: course.institutionId ?? null,
      isPersonal: Boolean(course.isPersonal),
    });
    await voiceSessionModel.updateOne({ sessionId }, { $set: { tutorSessionId: created._id } });
    return { tutorSessionId: String(created._id), messageCount: messages.length };
  }

  return { status, startSession, mintTokenFor, latestFor, retrieveEvidence, saveTranscript };
}
