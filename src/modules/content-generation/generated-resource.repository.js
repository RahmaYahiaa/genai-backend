import GeneratedResource from './generated-resource.model.js';

export async function createResource(doc) {
  return GeneratedResource.create(doc);
}

export async function findById(id) {
  return GeneratedResource.findById(id);
}

export async function listByUserCourse(userId, courseId, { skip = 0, limit = 20 } = {}) {
  // Failed generations are kept for audit but never listed to the learner.
  const filter = { userId, courseId, status: { $ne: 'unavailable' } };
  const [items, total] = await Promise.all([
    GeneratedResource.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    GeneratedResource.countDocuments(filter),
  ]);
  return { items, total };
}

export async function deleteById(id) {
  return GeneratedResource.deleteOne({ _id: id });
}
