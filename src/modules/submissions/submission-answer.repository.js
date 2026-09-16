import SubmissionAnswer, { toPublicSubmissionAnswer } from './submission-answer.model.js';

export async function upsert(attemptId, questionId, update) {
  return SubmissionAnswer.findOneAndUpdate(
    { attemptId, questionId },
    { $set: update, $setOnInsert: { attemptId, questionId } },
    { upsert: true, new: true },
  ).lean();
}

export async function findById(answerId) {
  return SubmissionAnswer.findById(answerId).lean();
}

export async function findByAttemptAndQuestion(attemptId, questionId) {
  return SubmissionAnswer.findOne({ attemptId, questionId }).lean();
}

export async function listByAttempt(attemptId) {
  return SubmissionAnswer.find({ attemptId }).sort({ questionId: 1 }).lean();
}

export async function countByAttempt(attemptId) {
  return SubmissionAnswer.countDocuments({ attemptId });
}

export { toPublicSubmissionAnswer };