import mongoose from 'mongoose';

/**
 * Per-student, per-course learning profile. Created lazily the first time a
 * student enters the learning flow of a course. Kept deliberately lean in
 * this stage: mastery/topic state is derived from learning_evidence by the
 * deterministic learner-model rules (next stage), which will extend this
 * collection without changing its identity.
 */
const learnerProfileSchema = new mongoose.Schema(
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
    // Denormalized tenancy scope (null for personal learning spaces).
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    isPersonal: { type: Boolean, default: false },
    status: { type: String, enum: ['active'], default: 'active' },
    lastActivityAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

learnerProfileSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

const LearnerProfile = mongoose.model('LearnerProfile', learnerProfileSchema);

/** Maps a lean learner profile to the public API shape. */
export function toPublicLearnerProfile(profile) {
  return {
    id: profile._id.toString(),
    studentId: profile.studentId.toString(),
    courseId: profile.courseId.toString(),
    status: profile.status,
    lastActivityAt: profile.lastActivityAt,
    initializedAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export default LearnerProfile;