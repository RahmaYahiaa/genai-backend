import RemedialContent from './remedial.model.js';
import { REMEDIAL_STATUSES } from '../../config/constants.js';

export async function create(data) {
  return RemedialContent.create(data);
}

export async function findById(remedialId) {
  return RemedialContent.findById(remedialId).lean();
}

export async function listByCourse(courseId, { status, skip, limit }) {
  const filter = { courseId, ...(status ? { status } : {}) };
  const query = RemedialContent.find(filter).sort({ createdAt: -1 });
  if (skip) query.skip(skip);
  if (limit) query.limit(limit);
  const [items, total] = await Promise.all([
    query.lean(),
    RemedialContent.countDocuments(filter),
  ]);
  return { items, total };
}

export async function listPublishedForStudent(courseId, studentId) {
  return RemedialContent.find({
    courseId,
    status: REMEDIAL_STATUSES.PUBLISHED,
    $or: [{ audienceType: 'ALL_STUDENTS' }, { audienceStudentIds: studentId }],
  })
    .sort({ publishedAt: -1 })
    .lean();
}

export async function updateById(remedialId, update) {
  return RemedialContent.findByIdAndUpdate(remedialId, update, { new: true }).lean();
}