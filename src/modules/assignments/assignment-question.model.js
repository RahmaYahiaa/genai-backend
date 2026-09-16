import mongoose from 'mongoose';

const assignmentQuestionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    orderIndex: { type: Number, required: true, min: 1 },
    questionText: { type: String, required: true, trim: true, maxlength: 10000 },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    maxScore: { type: Number, required: true, min: 0.5, max: 1000 },
    modelAnswer: { type: String, default: null, maxlength: 20000 },
    rubricText: { type: String, default: null, maxlength: 20000 },
  },
  { timestamps: true, versionKey: false },
);

assignmentQuestionSchema.index({ assignmentId: 1, orderIndex: 1 });

const AssignmentQuestion = mongoose.model('AssignmentQuestion', assignmentQuestionSchema);

export function toPublicAssignmentQuestion(question) {
  return {
    id: question._id.toString(),
    assignmentId: question.assignmentId.toString(),
    orderIndex: question.orderIndex,
    questionText: question.questionText,
    topicId: question.topicId.toString(),
    maxScore: question.maxScore,
    modelAnswer: question.modelAnswer ?? null,
    rubricText: question.rubricText ?? null,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

export default AssignmentQuestion;