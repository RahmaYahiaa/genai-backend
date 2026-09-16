import AnalyticsSnapshot from './analytics.model.js';

export async function upsertByCourse(courseId, { computedAt, payload }) {
  return AnalyticsSnapshot.findOneAndUpdate(
    { courseId },
    { $set: { computedAt, payload } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function findByCourse(courseId) {
  return AnalyticsSnapshot.findOne({ courseId }).lean();
}