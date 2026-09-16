import SubmissionAttempt, { toPublicSubmissionAttempt } from './submission-attempt.model.js';

export async function create(data) {
  return SubmissionAttempt.create(data);
}

export async function findById(attemptId) {
  return SubmissionAttempt.findById(attemptId).lean();
}

export async function findLatest(submissionId) {
  return SubmissionAttempt.findOne({ submissionId })
    .sort({ attemptNo: -1 })
    .lean();
}

export async function listBySubmission(submissionId) {
  return SubmissionAttempt.find({ submissionId }).sort({ attemptNo: 1 }).lean();
}

export async function markSubmitted(attemptId, submittedAt) {
  return SubmissionAttempt.findByIdAndUpdate(attemptId, { submittedAt }, { new: true }).lean();
}

export { toPublicSubmissionAttempt };