import ReassessmentSession, { toPublicReassessmentSession } from './reassessment-session.model.js';

export async function create(data) {
  return ReassessmentSession.create(data);
}

export async function findById(sessionId) {
  return ReassessmentSession.findById(sessionId).lean();
}

export async function listByStudentCourse(studentId, courseId) {
  return ReassessmentSession.find({ studentId, courseId }).sort({ createdAt: -1 }).lean();
}

export async function pushAnswer(sessionId, answer) {
  return ReassessmentSession.findByIdAndUpdate(
    sessionId,
    { $push: { answers: answer } },
    { new: true },
  ).lean();
}

export async function complete(sessionId) {
  return ReassessmentSession.findByIdAndUpdate(
    sessionId,
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true },
  ).lean();
}

export { toPublicReassessmentSession };