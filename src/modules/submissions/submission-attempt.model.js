import mongoose from 'mongoose';

const submissionAttemptSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    attemptNo: { type: Number, required: true, min: 1 },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

submissionAttemptSchema.index({ submissionId: 1, attemptNo: 1 }, { unique: true });

const SubmissionAttempt = mongoose.model('SubmissionAttempt', submissionAttemptSchema);

export function toPublicSubmissionAttempt(attempt) {
  return {
    id: attempt._id.toString(),
    submissionId: attempt.submissionId.toString(),
    attemptNo: attempt.attemptNo,
    submittedAt: attempt.submittedAt ?? null,
    createdAt: attempt.createdAt,
  };
}

export default SubmissionAttempt;