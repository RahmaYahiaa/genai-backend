import Submission, { toPublicSubmission } from './submission.model.js';

export async function create(data) {
  return Submission.create(data);
}

export async function findById(submissionId) {
  return Submission.findById(submissionId).lean();
}

export async function findByAssignmentAndStudent(assignmentId, studentId) {
  return Submission.findOne({ assignmentId, studentId }).lean();
}

export async function updateById(submissionId, update) {
  return Submission.findByIdAndUpdate(submissionId, update, { new: true }).lean();
}

export async function listByAssignment({ assignmentId, status, skip, limit }) {
  const filter = { assignmentId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    Submission.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Submission.countDocuments(filter),
  ]);
  return { items, total };
}

export { toPublicSubmission };