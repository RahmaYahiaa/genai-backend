import mongoose from 'mongoose';
import { SUBMISSION_STATUS } from '../../config/constants.js';

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
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

export default Submission;