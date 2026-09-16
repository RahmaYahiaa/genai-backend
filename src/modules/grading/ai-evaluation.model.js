import mongoose from 'mongoose';
import { AI_CONFIDENCE, AI_CORRECTNESS } from '../../config/constants.js';

const aiEvaluationSchema = new mongoose.Schema(
  {
    answerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubmissionAnswer',
      required: true,
      unique: true,
    },
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubmissionAttempt',
      required: true,
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssignmentQuestion',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    score: { type: Number, default: null, min: 0, max: 1000 },
    correctness: {
      type: String,
      enum: [...Object.values(AI_CORRECTNESS), null],
      default: null,
    },
    confidence: {
      type: String,
      enum: Object.values(AI_CONFIDENCE),
      required: true,
      index: true,
    },
    feedbackText: { type: String, default: null, maxlength: 8000 },
    misconceptions: {
      type: [
        {
          code: { type: String, required: true, maxlength: 80 },
          description: { type: String, required: true, maxlength: 500 },
        },
      ],
      default: [],
    },
    rubricBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    sourcesUsed: { type: mongoose.Schema.Types.Mixed, default: {} },
    modelVersion: { type: String, required: true, maxlength: 100 },
    promptVersion: { type: String, required: true, maxlength: 50 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

const AiEvaluation = mongoose.model('AiEvaluation', aiEvaluationSchema);

export function toPublicAiEvaluation(evaluation) {
  return {
    id: evaluation._id.toString(),
    answerId: evaluation.answerId.toString(),
    attemptId: evaluation.attemptId.toString(),
    submissionId: evaluation.submissionId.toString(),
    questionId: evaluation.questionId.toString(),
    courseId: evaluation.courseId.toString(),
    studentId: evaluation.studentId.toString(),
    topicId: evaluation.topicId.toString(),
    score: evaluation.score ?? null,
    correctness: evaluation.correctness ?? null,
    confidence: evaluation.confidence,
    feedbackText: evaluation.feedbackText ?? null,
    misconceptions: evaluation.misconceptions ?? [],
    rubricBreakdown: evaluation.rubricBreakdown ?? null,
    sourcesUsed: evaluation.sourcesUsed ?? {},
    modelVersion: evaluation.modelVersion,
    promptVersion: evaluation.promptVersion,
    createdAt: evaluation.createdAt,
  };
}

export default AiEvaluation;