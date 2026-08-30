import LearningEvidence, { toPublicEvidence } from './learning-evidence.model.js';

export async function create(data) {
  return LearningEvidence.create(data);
}

export async function listByAssessment(assessmentId) {
  return LearningEvidence.find({ assessmentId }).sort({ createdAt: 1 }).lean();
}

export async function listByStudentCourse(studentId, courseId) {
  return LearningEvidence.find({ studentId, courseId }).sort({ createdAt: -1 }).lean();
}

export { toPublicEvidence };