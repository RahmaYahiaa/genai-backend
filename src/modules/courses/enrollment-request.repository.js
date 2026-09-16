import EnrollmentRequest, { toPublicEnrollmentRequest } from './enrollment-request.model.js';
import { ConflictError } from '../../shared/errors/index.js';

const DUPLICATE_KEY_CODE = 11000;

export async function create(data) {
  try {
    return await EnrollmentRequest.create(data);
  } catch (error) {
    if (error?.code === DUPLICATE_KEY_CODE) {
      throw new ConflictError('You already have a request for this course');
    }
    throw error;
  }
}

export async function findById(requestId) {
  return EnrollmentRequest.findById(requestId).lean();
}

export async function findByStudentAndCourse(studentId, courseId) {
  return EnrollmentRequest.findOne({ studentId, courseId }).lean();
}

export async function listByStudent(studentId, { status, skip = 0, limit = 20 } = {}) {
  const filter = { studentId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    EnrollmentRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('courseId', 'title code')
      .lean(),
    EnrollmentRequest.countDocuments(filter),
  ]);
  return { items, total };
}

export async function listByInstitution(institutionId, { status, skip = 0, limit = 20 } = {}) {
  const filter = { institutionId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    EnrollmentRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('studentId', 'firstName lastName email')
      .populate('courseId', 'title code')
      .lean(),
    EnrollmentRequest.countDocuments(filter),
  ]);
  return { items, total };
}

export async function updateById(requestId, update) {
  return EnrollmentRequest.findByIdAndUpdate(requestId, update, { new: true }).lean();
}

export { toPublicEnrollmentRequest };