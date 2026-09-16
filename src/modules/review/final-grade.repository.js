import FinalGrade, { toPublicFinalGrade } from './final-grade.model.js';

export async function insertMany(rows) {
  return FinalGrade.insertMany(rows);
}

export async function listBySubmission(submissionId) {
  return FinalGrade.find({ submissionId }).sort({ createdAt: 1 }).lean();
}

export async function listBySubmissions(submissionIds) {
  return FinalGrade.find({ submissionId: { $in: submissionIds } }).lean();
}

export { toPublicFinalGrade };