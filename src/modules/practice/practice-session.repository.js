import PracticeSession, { toPublicPracticeSession } from './practice-session.model.js';

export async function create(data) {
  return PracticeSession.create(data);
}

export async function findById(sessionId) {
  return PracticeSession.findById(sessionId).lean();
}

export async function pushAnswer(sessionId, answer) {
  return PracticeSession.findByIdAndUpdate(
    sessionId,
    { $push: { answers: answer } },
    { new: true },
  ).lean();
}

export async function complete(sessionId) {
  return PracticeSession.findByIdAndUpdate(
    sessionId,
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true },
  ).lean();
}

export { toPublicPracticeSession };