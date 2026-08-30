import mongoose from 'mongoose';
import { GROUNDING_STATUSES, TUTOR_MODES } from '../../config/constants.js';

/**
 * A citation inside a tutor message: the exact trusted material chunk the
 * answer claim is grounded in. Generated text and its supporting evidence are
 * stored together here but remain traceable to material_chunks by id.
 */
const tutorCitationSchema = new mongoose.Schema(
  {
    chunkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialChunk',
      required: true,
    },
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    order: { type: Number, required: true, min: 0 },
    score: { type: Number, required: true, min: 0 },
    snippet: { type: String, required: true, maxlength: 400 },
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
    status: session.status,
    messages: (session.messages ?? []).map((message) => ({
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
    })),
    messageCount: (session.messages ?? []).length,
    createdAt: session.createdAt,
  };
}

export default TutorSession;