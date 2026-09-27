import { promises as fs } from 'node:fs';
import { config } from '../../config/index.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import Material from '../knowledge/material.model.js';
import { createFileStorage } from '../knowledge/file-storage.js';

const fileStorage = createFileStorage();
import * as documentIndexRepository from './document-index.repository.js';
import { toLernaStudentId } from './lerna.identity.js';

/**
 * LeRna domain adapter (the single place that knows Academic OS contracts):
 *
 * - identity: our user -> `genai-{id}` with lazy profile sync (name/course/language)
 * - tutor bridge: sessions/history mapping + material scoping via lazy per-student
 *   indexing into LeRna's Chroma store (Mode A); no indexing at all in Mode B
 * - study tools: the full 15-kind generation contract
 * - learner state: LAZILY aggregate NBA + study plan + SM-2 queue + preferences
 *
 * The adapter never invents contracts: everything here maps 1:1 onto
 * docs/openapi.json of the LeRna repository.
 */
export function createLernaService({ lernaClient }) {
  // Per-process cache so we sync each (user, courseCode) profile once per boot.
  const syncedContexts = new Set();

  function isReady() {
    return config.lerna.enabled;
  }

  /**
   * Lazy profile sync (LeRna `sync_learning_context`): called on first AI use
   * per user+course. Personal data transferred is deliberately minimal:
   * name, course code, language preference.
   */
  async function ensureProfile(user, courseCode) {
    if (!isReady()) return;
    const studentId = toLernaStudentId(user);
    const key = `${studentId}:${courseCode ?? 'none'}`;
    if (syncedContexts.has(key)) return;
    // Create-with-defaults on first contact only: once the AI profile exists,
    // re-syncs never overwrite preferences the student set explicitly via
    // PATCH /students/me/ai-preferences.
    let existing = null;
    try {
      existing = await lernaClient.get(`/students/${studentId}/profile`, { studentId });
    } catch {
      // no profile yet: created below with defaults
    }
    const body = {
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
      course: courseCode ?? 'General',
    };
    if (!existing) {
      body.preferred_language = user.aiLanguage ?? (user.languagePreference === 'ar' ? 'ar' : 'en');
    }
    await lernaClient.patch(`/students/${studentId}/preferences`, { studentId, body });
    syncedContexts.add(key);
  }

  async function getPreferences(user) {
    const studentId = toLernaStudentId(user);
    await ensureProfile(user, null).catch(() => {});
    const profile = await lernaClient.get(`/students/${studentId}/profile`, { studentId });
    return {
      studentId: profile.student_id,
      name: profile.name,
      course: profile.course,
      preferredLanguage: profile.preferred_language,
      learningPreference: profile.learning_preference,
      conceptMastery: profile.concept_mastery ?? {},
      weakConcepts: profile.weak_concepts ?? [],
      unknownConcepts: profile.unknown_concepts ?? [],
      strengths: profile.strengths ?? [],
    };
  }

  async function updatePreferences(user, patch) {
    const studentId = toLernaStudentId(user);
    const body = {};
    if (patch.preferredLanguage !== undefined) body.preferred_language = patch.preferredLanguage;
    if (patch.learningPreference !== undefined) body.learning_preference = patch.learningPreference;
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.course !== undefined) body.course = patch.course;
    const profile = await lernaClient.patch(`/students/${studentId}/preferences`, { studentId, body });
    syncedContexts.clear(); // next ensureProfile re-reads fresh state lazily
    return {
      studentId: profile.student_id,
      name: profile.name,
      course: profile.course,
      preferredLanguage: profile.preferred_language,
      learningPreference: profile.learning_preference,
      conceptMastery: profile.concept_mastery ?? {},
      weakConcepts: profile.weak_concepts ?? [],
      unknownConcepts: profile.unknown_concepts ?? [],
      strengths: profile.strengths ?? [],
    };
  }

  /**
   * Tutor bridge (POST /tutor/chat). History is rebuilt from our persisted
   * Mongo session so LeRna session/state stays contract-faithful
   * (chat_history is clipped to the last 4 turns server-side regardless).
   */
  async function askTutor({ user, course, session, question, documentIds, language }) {
    const studentId = toLernaStudentId(user);
    const courseCode = course.code ?? course.title?.en ?? 'General';
    await ensureProfile(user, courseCode);

    const chatHistory = (session.messages ?? [])
      .slice(-8)
      .map((message) => ({
        role: message.role === 'student' ? 'user' : 'assistant',
        content: String(message.content ?? '').slice(0, 1800),
      }))
      .filter((turn) => turn.content.trim().length > 0);

    const response = await lernaClient.post('/tutor/chat', {
      studentId,
      timeoutMs: config.lerna.tutorTimeoutMs,
      body: {
        student_id: studentId,
        course_id: courseCode,
        message: question,
        language: language ?? null,
        document_ids: documentIds ?? null,
        tutoring_style: 'direct',
        session_id: `genai-${session._id}`,
        chat_history: chatHistory,
      },
    });
    return response;
  }

  /**
   * Mode A material scoping: translates our Material ObjectIds into LeRna
   * document_ids, lazily indexing each student's copy on first scoped use.
   * Only files actually stored (storageKey present) can be indexed; anything
   * else is reported honestly instead of being skipped silently.
   */
  async function ensureDocumentIds(user, course, materialIds) {
    const studentId = toLernaStudentId(user);
    const courseCode = course.code ?? course.title?.en ?? 'General';
    const documentIds = [];
    for (const materialId of materialIds) {
      const material = await Material.findById(materialId).lean();
      if (!material) throw new NotFoundError('Material not found');

      const existing = await documentIndexRepository.findIndexedCopy(user.id, material._id);
      if (existing) {
        documentIds.push(existing.documentId);
        continue;
      }

      if (!material.storageKey) {
        throw new ValidationError(
          'One of the selected materials has no stored file and cannot be indexed into the AI knowledge base.',
        );
      }
      // Same resolution as the upload storage (relative to the repo root, not
      // the process working directory).
      let fileBuffer;
      try {
        fileBuffer = await fs.readFile(await fileStorage.requireMaterialFile(material.storageKey));
      } catch {
        throw new ValidationError('The stored file for a selected material could not be read for AI indexing.');
      }

      await ensureProfile(user, courseCode);
      try {
        const formData = new FormData();
        const fileName = material.originalName ?? `${material._id}.txt`;
        formData.append('file', new Blob([fileBuffer]), fileName);
        formData.append('course', courseCode);
        formData.append('student_id', studentId);
        const uploaded = await lernaClient.post('/materials/upload', { studentId, formData });
        await documentIndexRepository.recordIndexedCopy({
          userId: user.id,
          materialId: material._id,
          documentId: uploaded.document_id,
          courseCode,
        });
        documentIds.push(uploaded.document_id);
      } catch (error) {
        await documentIndexRepository
          .recordIndexFailure({ userId: user.id, materialId: material._id, error })
          .catch(() => {});
        throw error;
      }
    }
    return documentIds;
  }

  /** Study tools (POST /study-tools/generate) — full 15-kind contract. */
  async function generateStudyTools({ user, course, topic, kinds, language, documentIds = null }) {
    const studentId = toLernaStudentId(user);
    const courseCode = course?.code ?? course?.title?.en ?? 'General';
    await ensureProfile(user, courseCode);
    return lernaClient.post('/study-tools/generate', {
      studentId,
      body: {
        student_id: studentId,
        topic,
        kinds,
        language: language ?? 'en',
        document_ids: documentIds?.length ? documentIds : null,
      },
    });
  }

  async function getLearningState(user) {
    const studentId = toLernaStudentId(user);
    await ensureProfile(user, null).catch(() => {});
    return lernaClient.get(`/students/${studentId}/learning`, { studentId });
  }

  async function recordConceptReview(user, concept, remembered) {
    const studentId = toLernaStudentId(user);
    return lernaClient.post('/spaced-repetition/review', {
      studentId,
      body: { student_id: studentId, concept, remembered: Boolean(remembered) },
    });
  }

  async function downloadArtifact(downloadUrl, user) {
    return lernaClient.download(downloadUrl, toLernaStudentId(user));
  }

  async function health() {
    return lernaClient.get('/health');
  }

  // Fast availability probe (short timeout, cached) so callers with a local
  // fallback don't make the student wait for the full request timeout when
  // the engine is down, or when it is up but has no working model.
  let availability = { value: null, at: 0 };
  async function canGenerate() {
    const now = Date.now();
    const ttl = availability.value ? 60_000 : 15_000;
    if (availability.value !== null && now - availability.at < ttl) return availability.value;
    let value;
    try {
      const status = await lernaClient.get('/health', { timeoutMs: config.lerna.probeTimeoutMs });
      value = status?.ai_status?.real_generation_ready !== false;
    } catch {
      value = false;
    }
    availability = { value, at: now };
    return value;
  }
  function markUnavailable() {
    availability = { value: false, at: Date.now() };
  }

  async function capabilities() {
    return lernaClient.get('/capabilities');
  }

  return {
    isReady,
    ensureProfile,
    getPreferences,
    updatePreferences,
    askTutor,
    ensureDocumentIds,
    generateStudyTools,
    getLearningState,
    recordConceptReview,
    downloadArtifact,
    health,
    canGenerate,
    markUnavailable,
    capabilities,
  };
}

export function createLearningLernaBridge(service) {
  return service;
}
