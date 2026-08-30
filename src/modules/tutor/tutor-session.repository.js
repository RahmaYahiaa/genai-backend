import TutorSession, { toPublicTutorSession } from './tutor-session.model.js';

export async function create(data) {
  return TutorSession.create(data);
}

export async function findById(sessionId) {
  return TutorSession.findById(sessionId).lean();
}

export async function listByStudentCourse(studentId, courseId) {
  return TutorSession.find({ studentId, courseId }).sort({ createdAt: -1 }).lean();
}

export async function pushMessage(sessionId, message) {
  return TutorSession.findByIdAndUpdate(
    sessionId,
    { $push: { messages: message } },
    { new: true },
  ).lean();
}

export { toPublicTutorSession };