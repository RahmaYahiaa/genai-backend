import Course, { toPublicCourse } from './course.model.js';
import { ConflictError } from '../../shared/errors/index.js';

const DUPLICATE_KEY_CODE = 11000;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTextFilter(q) {
  if (!q) return {};
  const pattern = new RegExp(escapeRegex(q), 'i');
  return { $or: [{ title: pattern }, { code: pattern }] };
}

export async function create(data) {
  try {
    return await Course.create(data);
  } catch (error) {
    if (error?.code === DUPLICATE_KEY_CODE && error?.keyValue?.code !== undefined) {
      throw new ConflictError('A course with this code already exists in this institution');
    }
    throw error;
  }
}

export async function findById(courseId) {
  return Course.findById(courseId).lean();
}

export async function updateById(courseId, update) {
  return Course.findByIdAndUpdate(courseId, update, { new: true }).lean();
}

export async function addTopic(courseId, topicData) {
  const updated = await Course.findByIdAndUpdate(
    courseId,
    { $push: { topics: topicData } },
    { new: true },
  ).lean();
  const pushed = updated.topics[updated.topics.length - 1];
  return { updatedCourse: updated, topic: pushed };
}

export async function updateTopic(courseId, topicId, topicData) {
  const setFields = {};
  for (const [key, value] of Object.entries(topicData)) {
    setFields[`topics.$.${key}`] = value;
  }
  const updated = await Course.findOneAndUpdate(
    { _id: courseId, 'topics._id': topicId },
    { $set: setFields },
    { new: true },
  ).lean();
  if (!updated) return null;
  return {
    updatedCourse: updated,
    topic: updated.topics.find((t) => String(t._id) === String(topicId)),
  };
}

export async function deleteTopic(courseId, topicId) {
  const updated = await Course.findByIdAndUpdate(
    courseId,
    { $pull: { topics: { _id: topicId } } },
    { new: true },
  ).lean();
  if (!updated) return null;
  // Clean dangling prerequisites in sibling topics.
  await Course.updateOne(
    { _id: courseId },
    { $pull: { 'topics.$[t].prerequisiteTopicIds': topicId } },
    { arrayFilters: [{ 't.prerequisiteTopicIds': topicId }] },
  );
  return updated;
}

export async function addStaffMember(courseId, staffEntry) {
  return Course.findByIdAndUpdate(courseId, { $push: { staff: staffEntry } }, { new: true }).lean();
}

export async function removeStaffMember(courseId, userId) {
  const updated = await Course.findByIdAndUpdate(
    courseId,
    { $pull: { staff: { userId } } },
    { new: true },
  ).lean();
  const removed = updated && !updated.staff.some((s) => String(s.userId) === String(userId));
  return { updatedCourse: updated, removed };
}

export async function hasStaffMember(courseId, userId) {
  const course = await Course.findOne({ _id: courseId, 'staff.userId': userId })
    .select('_id')
    .lean();
  return Boolean(course);
}

export async function listInstitutionCourses({ institutionId, q, skip, limit }) {
  const filter = { institutionId, isPersonal: false, ...buildTextFilter(q) };
  const [items, total] = await Promise.all([
    Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  return { items, total };
}

export async function listStaffedCourses({ userId, q, skip, limit }) {
  const filter = { 'staff.userId': userId, ...buildTextFilter(q) };
  const [items, total] = await Promise.all([
    Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  return { items, total };
}

export async function listStudentCourses({ studentId, enrolledCourseIds, q, skip, limit }) {
  const filter = {
    $or: [{ _id: { $in: enrolledCourseIds } }, { ownerId: studentId }],
    ...buildTextFilter(q),
  };
  const [items, total] = await Promise.all([
    Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  return { items, total };
}

export { toPublicCourse };