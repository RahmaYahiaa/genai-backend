import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { GROUNDING_STATUSES, RETRIEVAL_SETTINGS } from '../../config/constants.js';
import {
  AiProviderError,
  AiServiceUnavailableError,
  InsufficientEvidenceError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { toPublicTutorSession } from './tutor-session.model.js';
import { llmExternalAnswerSchema, llmTutorAnswerSchema } from './tutor.schema.js';
import {
  isWebSearchEnabled,
  planSourceStrategy,
  searchTrustedSources,
} from '../../shared/web/trusted-search.js';
import { chunkText } from '../../shared/text/chunker.js';
import { cosineSimilarity } from '../../shared/math/vector-math.js';

const TUTOR_SYSTEM_PROMPT =
  'You are a course tutor for an academic learning platform. ' +
  'Answer ONLY from the trusted course material excerpts provided in the input. ' +
  'Every claim must come from those excerpts; if they are not enough, say so. ' +
  'Speak directly to the student in a friendly teaching voice; never mention "excerpts", "chunks", "source 1" or the input - the app shows the sources separately. ' +
  'Answer in the same language as the student question (Arabic question -> Arabic answer with technical terms kept in English where standard). ' +
  'Respond with JSON only, matching exactly: ' +
  '{"answer":"<your grounded explanation>","usedChunkIds":["<ids of the excerpts you actually used>"]}';

const EXTERNAL_TUTOR_SYSTEM_PROMPT =
  'You are a course tutor for an academic learning platform. ' +
  'Answer ONLY from the trusted external academic sources provided in the input - never from your own memory. ' +
  'Every claim must come from those sources; if they are not enough, say so. ' +
  'Speak directly to the student in a friendly teaching voice; never mention "excerpts", "chunks", "source 1" or the input - the app shows the sources separately. ' +
  'Answer in the same language as the student question (Arabic question -> Arabic answer with technical terms kept in English where standard). ' +
  'Respond with JSON only, matching exactly: ' +
  '{"answer":"<your grounded explanation>","usedSourceIndexes":[<1-based indexes of the sources you actually used>]}';

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
  embeddingProvider = null,
  lernaService = null,
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

  async function renameSession(user, courseId, tutorSessionId, title) {
    const { session } = await requireOwnedSession(user, courseId, tutorSessionId);
    const updated = await tutorSessionRepository.setTitle(session._id, title?.trim() || null);
    return toPublicTutorSession(updated);
  }

  async function deleteSession(user, courseId, tutorSessionId) {
    const { session } = await requireOwnedSession(user, courseId, tutorSessionId);
    await tutorSessionRepository.deleteById(session._id);
    return { id: String(session._id), deleted: true };
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

    // LeRna (Academic OS) is the source of truth for AI behaviour: when the
    // integration is enabled the whole answer path (grounding, citation
    // discipline, trusted external discovery, abstention) runs inside LeRna.
    // Our session/persistence contract stays exactly the same.
    let studentRecorded = false;
    const lernaUsable = config.lerna.enabled && lernaService?.isReady?.() &&
      (lernaService.canGenerate ? await lernaService.canGenerate() : true);
    if (config.lerna.enabled && !lernaUsable) {
      logger.warn({ courseId }, 'Tutor: AI engine not ready, using local grounded pipeline');
    }
    if (lernaUsable) {
      try {
        return await askViaLerna({ user, course, session, data });
      } catch (error) {
        // An honest abstention from the AI engine stands. Only when the engine
        // itself is unreachable / times out do we answer through the local
        // pipeline below (course material first, then trusted external sources),
        // so the student still gets a grounded answer.
        if (!(error instanceof AiServiceUnavailableError)) throw error;
        if (!error.engineUp) lernaService.markUnavailable?.();
        logger.warn({ err: error.message, courseId }, 'Tutor: AI engine unavailable, using local grounded pipeline');
        // askViaLerna records the question before calling the engine
        studentRecorded = !error.beforeRecord;
      }
    }

    // Trusted retrieval first (RAG): courseId filter is applied inside the
    // vector search, chunks below the relevance floor are dropped. Optional
    // materialIds scope retrieval to the student's chosen files (EDUNation
    // "Use materials" parity); scoped questions never fall back to the web.
    const scoped = Array.isArray(data.materialIds) && data.materialIds.length > 0;
    // A course with no (indexed) material for this question must not fail the
    // request: an empty or failed retrieval simply means "no course evidence",
    // which routes to trusted external sources below.
    let contexts = [];
    try {
      ({ contexts } = await retrievalService.retrieveContext({
        courseId: courseDocumentId(course),
        query: data.content,
        materialIds: scoped ? data.materialIds : null,
      }));
    } catch (error) {
      logger.warn({ err: error.message, courseId }, 'Tutor: course material retrieval failed, treating as no course evidence');
    }

    // The student question is always recorded, even when we refuse to answer.
    if (!studentRecorded) {
      await tutorSessionRepository.pushMessage(session._id, {
        role: 'student',
        content: data.content,
        citations: [],
        grounding: null,
      });
    }

    // General-mode fallback (EDUNation parity): when course material has no
    // sufficiently-matching evidence, try trusted external academic discovery
    // instead of the model's memory. Still abstain when nothing trusted fits.
    if (contexts.length === 0 && !scoped) {
      return answerFromTrustedExternal({ user, course, session, topicTitle, question: data.content });
    }

    if (contexts.length === 0) {
      throw new InsufficientEvidenceError(
        `No trusted material in the selected course materials matches the question closely enough to answer safely`,
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
      // The retrieved course excerpts did not actually support an answer:
      // same rule as "no material" -> trusted external sources (unless the
      // student explicitly limited the tutor to specific files).
      if (!scoped) {
        return answerFromTrustedExternal({ user, course, session, topicTitle, question: data.content });
      }
      // Scoped to specific files and those files don't answer it: an honest
      // "not in your selected files" (422), not a provider failure.
      throw new InsufficientEvidenceError(
        'The selected course materials do not contain enough information to answer this question',
      );
    }

    const updated = await tutorSessionRepository.pushMessage(session._id, {
      role: 'tutor',
      content: generated.answer,
      citations,
      grounding: GROUNDING_STATUSES.GROUNDED,
    });

    return shapedAnswer(updated, 'uploaded_material');
  }

  /**
   * LeRna-backed answer path. The student question is recorded first (even on
   * refusal), then the AI service answers; `abstained: true` maps onto the
   * same 422 INSUFFICIENT_EVIDENCE contract the legacy path used, so the
   * frontend abstain state works identically.
   */
  async function askViaLerna({ user, course, session, data }) {
    const scoped = Array.isArray(data.materialIds) && data.materialIds.length > 0;
    let documentIds = null;
    if (scoped) {
      try {
        documentIds = await lernaService.ensureDocumentIds(user, course, data.materialIds);
      } catch (error) {
        // The chosen files could not be sent to the AI engine (file missing on
        // disk, upload rejected...). They are indexed locally too, so answer
        // through the local grounded pipeline instead of failing the chat.
        logger.warn({ err: error.message }, 'Tutor: could not index selected files in the AI engine, using local pipeline');
        const fallback = new AiServiceUnavailableError('Selected files could not be indexed in the AI engine');
        fallback.beforeRecord = true;
        fallback.engineUp = true;
        throw fallback;
      }
    }

    // The student question is always recorded, even when the tutor abstains.
    await tutorSessionRepository.pushMessage(session._id, {
      role: 'student',
      content: data.content,
      citations: [],
      grounding: null,
    });

    const response = await lernaService.askTutor({
      user,
      course,
      session,
      question: data.content,
      documentIds,
    });

    if (response.abstained) {
      throw new InsufficientEvidenceError(
        response.answer ||
          'No trusted material matches the question closely enough to answer safely',
      );
    }

    const knowledgeSource =
      response.source_type === 'student_upload' ? 'uploaded_material' : 'trusted_external';
    const citations = (response.evidence ?? []).map((item, index) => ({
      chunkId: null,
      materialId: null,
      order: index,
      score: typeof item.trust_score === 'number' ? item.trust_score : 0,
      snippet: String(item.excerpt ?? '').slice(0, 400),
      sourceUrl: item.url ?? null,
      sourceTitle: item.source ?? null,
      sourceDomain: item.url ? new URL(item.url).hostname : null,
      sourceAuthority: item.authority ?? null,
    }));

    const updated = await tutorSessionRepository.pushMessage(session._id, {
      role: 'tutor',
      content: response.answer,
      citations,
      grounding:
        knowledgeSource === 'uploaded_material'
          ? GROUNDING_STATUSES.GROUNDED
          : GROUNDING_STATUSES.EXTERNAL_TRUSTED,
      knowledgeSource,
      searchState: response.search_state ?? null,
      evidenceLimitation: response.evidence_limitation ?? null,
    });

    return shapedAnswer(updated, knowledgeSource);
  }

  function mapCitation(citation) {
    return {
      chunkId: citation.chunkId ? citation.chunkId.toString() : null,
      materialId: citation.materialId ? citation.materialId.toString() : null,
      order: citation.order,
      score: citation.score,
      snippet: citation.snippet,
      sourceUrl: citation.sourceUrl ?? null,
      sourceTitle: citation.sourceTitle ?? null,
      sourceDomain: citation.sourceDomain ?? null,
      sourceAuthority: citation.sourceAuthority ?? null,
    };
  }

  function shapedAnswer(sessionDoc, knowledgeSource) {
    const message = sessionDoc.messages[sessionDoc.messages.length - 1];
    return {
      sessionId: sessionDoc._id.toString(),
      knowledgeSource: message.knowledgeSource ?? knowledgeSource,
      message: {
        id: message._id.toString(),
        role: message.role,
        content: message.content,
        grounding: message.grounding ?? null,
        knowledgeSource: message.knowledgeSource ?? knowledgeSource,
        searchState: message.searchState ?? null,
        evidenceLimitation: message.evidenceLimitation ?? null,
        citations: (message.citations ?? []).map(mapCitation),
        createdAt: message.createdAt,
      },
    };
  }

  /**
   * Trusted external path (EDUNation flow B): plan sources -> Tavily trusted
   * search (registry-gated, SSRF-guarded) -> chunk + embed -> relevance gate
   * -> grounded LLM answer citing sources by index. Any failure to find
   * trusted evidence abstains explicitly; the model's memory is never used.
   */
  async function answerFromTrustedExternal({ _user, _course, session, topicTitle, question }) {
    if (!isWebSearchEnabled() || !embeddingProvider) {
      throw new InsufficientEvidenceError(
        'No trusted material in this course matches the question closely enough, and trusted external discovery is not available',
      );
    }
    const strategy = await planSourceStrategy({ query: question, topic: topicTitle, llmProvider });
    let { state, sources } = await searchTrustedSources({
      query: strategy.query,
      categories: strategy.categories,
    });
    // Most trusted academic sources are in English: when a (e.g. Arabic)
    // question finds nothing, retry once with the topic title plus any Latin
    // technical terms from the question.
    if (state !== 'ready' || sources.length === 0) {
      const latinTerms = (question.match(/[A-Za-z][A-Za-z0-9+#.'-]*/g) ?? []).join(' ');
      const retries = [
        question,
        [topicTitle !== 'Unknown topic' ? topicTitle : '', latinTerms].join(' ').trim(),
      ].filter((q, i, all) => q && q !== strategy.query && all.indexOf(q) === i);
      for (const retryQuery of retries) {
        ({ state, sources } = await searchTrustedSources({ query: retryQuery, categories: strategy.categories }));
        if (state === 'ready' && sources.length > 0) break;
      }
    }
    if (state !== 'ready' || sources.length === 0) {
      throw new InsufficientEvidenceError(
        'No trusted material in this course matches the question closely enough, and no trusted external academic source could answer it either',
      );
    }

    const topSources = sources.slice(0, 3);
    const chunkRows = [];
    for (const [sourceIndex, source] of topSources.entries()) {
      const chunks = chunkText(source.text, { maxChars: config.chunk.maxChars, overlapChars: config.chunk.overlapChars }).slice(0, 3);
      for (const text of chunks) {
        chunkRows.push({ sourceIndex, source, text });
      }
    }
    const [queryVector, ...chunkVectors] = await embeddingProvider.embed([
      question,
      ...chunkRows.map((row) => row.text),
    ]);
    const ranked = chunkRows
      .map((row, index) => ({ ...row, score: cosineSimilarity(queryVector, chunkVectors[index]) }))
      .filter((row) => row.score >= RETRIEVAL_SETTINGS.MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (ranked.length === 0) {
      throw new InsufficientEvidenceError(
        'Trusted external sources were found but none matched the question closely enough to answer safely',
      );
    }

    // Renumber deduplicated sources 1..N for the citation contract.
    const usedSources = [...new Map(ranked.map((row) => [row.sourceIndex, row.source])).values()];
    const indexBySource = new Map(usedSources.map((source, index) => [source, index + 1]));
    const generated = parseLlmJson(
      await llmProvider.completeJson({
        task: 'answer_tutor_question_external',
        system: EXTERNAL_TUTOR_SYSTEM_PROMPT,
        user: JSON.stringify({
          topicTitle,
          mode: session.mode,
          question,
          sources: usedSources.map((source, index) => ({
            index: index + 1,
            title: source.title,
            url: source.url,
            excerpts: ranked
              .filter((row) => row.source === source)
              .map((row) => row.text.slice(0, 1200)),
          })),
        }),
      }),
      llmExternalAnswerSchema,
      'answer_tutor_question_external',
    );

    const citations = [];
    for (const usedIndex of generated.usedSourceIndexes ?? []) {
      const source = usedSources[usedIndex - 1];
      if (!source) continue;
      const best = ranked.find((row) => row.source === source);
      citations.push({
        chunkId: null,
        materialId: null,
        order: indexBySource.get(source) - 1,
        score: best?.score ?? 0,
        snippet: best ? best.text.slice(0, 400) : source.text.slice(0, 400),
        sourceUrl: source.url,
        sourceTitle: source.title,
        sourceDomain: source.domain,
        sourceAuthority: source.authority,
      });
    }
    if (citations.length === 0) {
      throw new AiProviderError(
        'answer_tutor_question_external: AI answer was not grounded in trusted sources',
      );
    }

    const updated = await tutorSessionRepository.pushMessage(session._id, {
      role: 'tutor',
      content: generated.answer,
      citations,
      grounding: GROUNDING_STATUSES.EXTERNAL_TRUSTED,
    });
    return shapedAnswer(updated, 'trusted_external');
  }

  return { createSession, listSessions, getSession, askQuestion, renameSession, deleteSession };
}