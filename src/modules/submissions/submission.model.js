import mongoose from 'mongoose';
import { SUBMISSION_STATUS, FINAL_GRADE_DECISIONS } from '../../config/constants.js';

const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.DRAFT,
      index: true,
    },
    currentAttemptNo: { type: Number, required: true, min: 1, default: 1 },
    submittedAt: { type: Date, default: null },
    finalScoreTotal: { type: Number, default: null, min: 0, max: 100000 },
    finalFeedback: { type: String, default: null, maxlength: 4000 },
    finalDecision: {
      type: String,
      enum: [...Object.values(FINAL_GRADE_DECISIONS), null],
      default: null,
    },
    resubmissionReason: { type: String, default: null, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false },
);

submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);

export function toPublicSubmission(submission) {
  return {
    id: submission._id.toString(),
    assignmentId: submission.assignmentId.toString(),
    studentId: submission.studentId.toString(),
    status: submission.status,
    currentAttemptNo: submission.currentAttemptNo,
    submittedAt: submission.submittedAt ?? null,
    finalScoreTotal: submission.finalScoreTotal ?? null,
    finalFeedback: submission.finalFeedback ?? null,
    finalDecision: submission.finalDecision ?? null,
    resubmissionReason: submission.resubmissionReason ?? null,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

export default Submission;