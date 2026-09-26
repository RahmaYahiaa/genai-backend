import mongoose from 'mongoose';
import { GROUNDING_STATUSES, TUTOR_MODES } from '../../config/constants.js';

/**
 * A citation inside a tutor message: the exact trusted material chunk the
 * answer claim is grounded in. Generated text and its supporting evidence are
 * stored together here but remain traceable to material_chunks by id.
 */
const tutorCitationSchema = new mongoose.Schema(
  {
    // Course-material citation: the exact trusted chunk the answer claim is
    // grounded in (null for trusted-external web citations).
    chunkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialChunk',
      default: null,
    },
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      default: null,
    },
    order: { type: Number, required: true, min: 0 },
    score: { type: Number, required: true, min: 0 },
    snippet: { type: String, required: true, maxlength: 400 },
    // Trusted-external citation (source discovered via the trust registry).
    sourceUrl: { type: String, default: null, maxlength: 1000 },
    sourceTitle: { type: String, default: null, maxlength: 300 },
    sourceDomain: { type: String, default: null, maxlength: 200 },
    sourceAuthority: { type: String, default: null, maxlength: 60 },
  },
  { _id: false },
);

const tutorMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['student', 'tutor'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    // Tutor messages only: the trusted chunks the answer is grounded in.
    citations: { type: [tutorCitationSchema], default: [] },
    grounding: {
      type: String,
      enum: Object.values(GROUNDING_STATUSES),
      default: null,
    },
    // LeRna-bridge persistence (additive): where the grounded evidence came
    // from and the AI facade search state; null on legacy-path messages.
    knowledgeSource: {
      type: String,
      enum: ['uploaded_material', 'trusted_external', null],
      default: null,
    },
    searchState: { type: String, default: null, maxlength: 60 },
    // Partial-coverage notice emitted by the grounding validator (null when
    // the evidence fully covered the answer).
    evidenceLimitation: { type: String, default: null, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

/**
 * An AI tutor conversation for one student on one course topic. Every tutor
 * answer MUST carry citations into the course's own material chunks - the
 * retrieval gate (422 INSUFFICIENT_EVIDENCE) runs before the LLM is ever
 * called, so an ungrounded answer cannot exist by construction.
 */
const tutorSessionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    mode: {
      type: String,
      enum: Object.values(TUTOR_MODES),
      default: TUTOR_MODES.EXPLANATION,
    },
    // Optional student-chosen name for the chat (null = derived in the UI).
    title: { type: String, trim: true, maxlength: 120, default: null },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    messages: { type: [tutorMessageSchema], default: [] },
    // Denormalized tenancy scope (null for personal learning spaces).
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    isPersonal: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tutorSessionSchema.index({ studentId: 1, courseId: 1, createdAt: -1 });

const TutorSession = mongoose.model('TutorSession', tutorSessionSchema);

/** Maps a lean tutor session to the public API shape (owner's own view). */
export function toPublicTutorSession(session) {
  return {
    id: session._id.toString(),
    studentId: session.studentId.toString(),
    courseId: session.courseId.toString(),
    topicId: session.topicId.toString(),
    mode: session.mode,
    title: session.title ?? null,
    status: session.status,
    messages: (session.messages ?? []).map((message) => ({
      id: message._id.toString(),
      role: message.role,
      content: message.content,
      grounding: message.grounding ?? null,
      knowledgeSource: message.knowledgeSource ?? null,
      searchState: message.searchState ?? null,
      evidenceLimitation: message.evidenceLimitation ?? null,
      citations: (message.citations ?? []).map((citation) => ({
        chunkId: citation.chunkId ? citation.chunkId.toString() : null,
        materialId: citation.materialId ? citation.materialId.toString() : null,
        order: citation.order,
        score: citation.score,
        snippet: citation.snippet,
        sourceUrl: citation.sourceUrl ?? null,
        sourceTitle: citation.sourceTitle ?? null,
        sourceDomain: citation.sourceDomain ?? null,
        sourceAuthority: citation.sourceAuthority ?? null,
      })),
      createdAt: message.createdAt,
    })),
    messageCount: (session.messages ?? []).length,
    createdAt: session.createdAt,
  };
}

export default TutorSession;