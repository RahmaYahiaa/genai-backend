import GeneratedResource from './generated-resource.model.js';

export async function createResource(doc) {
  return GeneratedResource.create(doc);
}

export async function findById(id) {
  return GeneratedResource.findById(id);
}

export async function listByUserCourse(userId, courseId, { skip = 0, limit = 20 } = {}) {
  const filter = { userId, courseId };
  const [items, total] = await Promise.all([
    GeneratedResource.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    GeneratedResource.countDocuments(filter),
  ]);
  return { items, total };
}
