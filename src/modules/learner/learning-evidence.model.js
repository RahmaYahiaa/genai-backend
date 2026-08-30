import mongoose from 'mongoose';
import { EVIDENCE_SOURCE_TYPES } from '../../config/constants.js';

/**
 * Structured Learning Evidence: the authoritative record that a student
 * demonstrated (or failed to demonstrate) a skill, anchored to
 * courseId + topicId (+ objective) and traceable to the producing assessment
 * and question. Mastery, gaps, and recommendations are later derived from
 * THIS collection by deterministic rules only.
 *
 * Deliberately excluded by design: any generated prose (feedback text lives
 * on the assessment document), any mastery aggregate, and any LLM-computed
 * score - `score` is derived by our fixed rule from `correctness`.
 */
const learningEvidenceSchema = new mongoose.Schema(
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
    objectiveCode: { type: String, default: null, maxlength: 30 },
    sourceType: {
      type: String,
      enum: Object.values(EVIDENCE_SOURCE_TYPES),
      required: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiagnosticAssessment',
      required: true,
    },
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    correctness: {
      type: String,
      enum: ['incorrect', 'partial', 'correct'],
      required: true,
    },
    score: { type: Number, required: true, min: 0, max: 1 },
    misconceptionCodes: { type: [String], default: [] },
    evaluationModel: { type: String, required: true },
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

learningEvidenceSchema.index({ studentId: 1, courseId: 1, topicId: 1, createdAt: -1 });
learningEvidenceSchema.index({ assessmentId: 1 });

const LearningEvidence = mongoose.model('LearningEvidence', learningEvidenceSchema);

/** Maps a lean evidence record to the public API shape (structured only). */
export function toPublicEvidence(evidence) {
  return {
    id: evidence._id.toString(),
    studentId: evidence.studentId.toString(),
    courseId: evidence.courseId.toString(),
    topicId: evidence.topicId.toString(),
    objectiveCode: evidence.objectiveCode ?? null,
    sourceType: evidence.sourceType,
    assessmentId: evidence.assessmentId.toString(),
    questionId: evidence.questionId.toString(),
    correctness: evidence.correctness,
    score: evidence.score,
    misconceptionCodes: evidence.misconceptionCodes ?? [],
    evaluationModel: evidence.evaluationModel,
    createdAt: evidence.createdAt,
  };
}

export default LearningEvidence;