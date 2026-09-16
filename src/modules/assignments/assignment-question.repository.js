import AssignmentQuestion, { toPublicAssignmentQuestion } from './assignment-question.model.js';

export async function create(data) {
  return AssignmentQuestion.create(data);
}

export async function findById(questionId) {
  return AssignmentQuestion.findById(questionId).lean();
}

export async function listByAssignment(assignmentId) {
  return AssignmentQuestion.find({ assignmentId }).sort({ orderIndex: 1 }).lean();
}

export async function countByAssignment(assignmentId) {
  return AssignmentQuestion.countDocuments({ assignmentId });
}

export async function nextOrderIndex(assignmentId) {
  const last = await AssignmentQuestion.findOne({ assignmentId })
    .sort({ orderIndex: -1 })
    .select('orderIndex')
    .lean();
  return (last?.orderIndex ?? 0) + 1;
}

export async function updateById(questionId, update) {
  return AssignmentQuestion.findByIdAndUpdate(questionId, update, { new: true }).lean();
}

export async function deleteById(assignmentId, questionId) {
  return AssignmentQuestion.findOneAndDelete({ _id: questionId, assignmentId }).lean();
}

export { toPublicAssignmentQuestion };