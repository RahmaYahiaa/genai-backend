import Assignment, { toPublicAssignment } from './assignment.model.js';

export async function create(data) {
  return Assignment.create(data);
}

export async function findById(assignmentId) {
  return Assignment.findById(assignmentId).lean();
}

export async function updateById(assignmentId, update) {
  return Assignment.findByIdAndUpdate(assignmentId, update, { new: true }).lean();
}

export async function listByCourse({ courseId, status, skip, limit }) {
  const filter = { courseId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    Assignment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Assignment.countDocuments(filter),
  ]);
  return { items, total };
}

export { toPublicAssignment };