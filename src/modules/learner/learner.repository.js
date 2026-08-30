import LearnerProfile, { toPublicLearnerProfile } from './learner-profile.model.js';

export async function upsertForCourse({ studentId, courseId, institutionId, isPersonal }) {
  return LearnerProfile.findOneAndUpdate(
    { studentId, courseId },
    {
      $setOnInsert: { studentId, courseId, institutionId, isPersonal, status: 'active' },
      $set: { lastActivityAt: new Date() },
    },
    { upsert: true, new: true },
  ).lean();
}

export async function findByCourse(studentId, courseId) {
  return LearnerProfile.findOne({ studentId, courseId }).lean();
}

export { toPublicLearnerProfile };