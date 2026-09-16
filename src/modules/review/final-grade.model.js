import mongoose from 'mongoose';
import { FINAL_GRADE_DECISIONS } from '../../config/constants.js';

const finalGradeSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubmissionAttempt',
      required: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    answerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubmissionAnswer',
      default: null,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    finalScore: { type: Number, required: true, min: 0, max: 100000 },
    finalFeedback: { type: String, default: null, maxlength: 4000 },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    decision: {
      type: String,
      enum: Object.values(FINAL_GRADE_DECISIONS),
      required: true,
    },
    aiOriginalScore: { type: Number, default: null, min: 0, max: 100000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

const FinalGrade = mongoose.model('FinalGrade', finalGradeSchema);

export function toPublicFinalGrade(grade) {
  return {
    id: grade._id.toString(),
    submissionId: grade.submissionId.toString(),
    attemptId: grade.attemptId.toString(),
    answerId: grade.answerId ? grade.answerId.toString() : null,
    questionId: grade.questionId ? grade.questionId.toString() : null,
    finalScore: grade.finalScore,
    finalFeedback: grade.finalFeedback ?? null,
    decision: grade.decision,
    decidedBy: grade.decidedBy.toString(),
    aiOriginalScore: grade.aiOriginalScore ?? null,
    decidedAt: grade.createdAt,
  };
}

export default FinalGrade;