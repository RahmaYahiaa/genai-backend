import mongoose from 'mongoose';

const submissionAnswerSchema = new mongoose.Schema(
  {
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubmissionAttempt',
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssignmentQuestion',
      required: true,
    },
    answerText: { type: String, default: null, maxlength: 20000 },
    imageUrl: { type: String, default: null, maxlength: 2048 },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

submissionAnswerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });

const SubmissionAnswer = mongoose.model('SubmissionAnswer', submissionAnswerSchema);

export function toPublicSubmissionAnswer(answer) {
  return {
    id: answer._id.toString(),
    attemptId: answer.attemptId.toString(),
    questionId: answer.questionId.toString(),
    answerText: answer.answerText ?? null,
    imageUrl: answer.imageUrl ?? null,
    savedAt: answer.savedAt ?? null,
  };
}

export default SubmissionAnswer;