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

export async function insertMany(rows) {
  return LearningEvidence.insertMany(rows);
}

/** Supersede: the latest attempt replaces any prior evidence for the same student+assignment. */
export async function deleteBySourceAssignment({ studentId, assignmentId }) {
  await LearningEvidence.deleteMany({
    studentId,
    sourceType: 'assignment',
    assessmentId: assignmentId,
  });
}

export async function listByCourseAndType(courseId, sourceType) {
  return LearningEvidence.find({ courseId, sourceType }).limit(5000).lean();
}

export { toPublicEvidence };