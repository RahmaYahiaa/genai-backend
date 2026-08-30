import Enrollment, { toPublicEnrollment } from './enrollment.model.js';
import { ConflictError } from '../../shared/errors/index.js';

const DUPLICATE_KEY_CODE = 11000;

export async function create({ studentId, courseId, enrolledBy }) {
  try {
    return await Enrollment.create({ studentId, courseId, enrolledBy });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY_CODE) {
      throw new ConflictError('Student is already enrolled in this course');
    }
    throw error;
  }
}

export async function exists(studentId, courseId) {
  const row = await Enrollment.findOne({ studentId, courseId }).select('_id').lean();
  return Boolean(row);
}

export async function remove(studentId, courseId) {
  const result = await Enrollment.deleteOne({ studentId, courseId });
  return result.deletedCount > 0;
}

export async function listCourseIds(studentId) {
  const rows = await Enrollment.find({ studentId }).select('courseId').lean();
  return rows.map((row) => row.courseId);
}

export async function listByCourse(courseId, { skip, limit }) {
  const [items, total] = await Promise.all([
    Enrollment.find({ courseId })
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('studentId', 'firstName lastName email')
      .lean(),
    Enrollment.countDocuments({ courseId }),
  ]);
  return { items, total };
}

export { toPublicEnrollment };