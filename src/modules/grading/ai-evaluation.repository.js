import AiEvaluation, { toPublicAiEvaluation } from './ai-evaluation.model.js';

export async function create(data) {
  return AiEvaluation.create(data);
}

export async function findByAnswerId(answerId) {
  return AiEvaluation.findOne({ answerId }).lean();
}

export async function listBySubmission(submissionId) {
  return AiEvaluation.find({ submissionId }).sort({ createdAt: 1 }).lean();
}

export async function listByAssignment(assignmentId) {
  return AiEvaluation.find({ assignmentId }).sort({ createdAt: 1 }).lean();
}

export async function listByAssignmentStudent(assignmentId, studentId) {
  return AiEvaluation.find({ assignmentId, studentId }).sort({ createdAt: 1 }).lean();
}

export { toPublicAiEvaluation };