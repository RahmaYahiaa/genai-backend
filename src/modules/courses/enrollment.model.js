import mongoose from 'mongoose';

/**
 * Student <-> institutional course membership. One lean collection queried
 * independently for rosters and student course lists. Rows are removed on
 * drop (lean phase); re-enrollment is allowed afterwards.
 */
const enrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    enrolledAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ courseId: 1 });

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

/**
 * Maps a lean enrollment to the public shape. When the query populated the
 * student, the full mini-profile is included; otherwise just the id.
 */
export function toPublicEnrollment(enrollment) {
  const raw = enrollment.studentId;
  const isPopulated = raw && typeof raw === 'object' && raw._id;

  return {
    id: enrollment._id.toString(),
    courseId: enrollment.courseId.toString(),
    student: isPopulated
      ? {
          id: raw._id.toString(),
          firstName: raw.firstName,
          lastName: raw.lastName,
          email: raw.email,
        }
      : { id: String(raw) },
    enrolledBy: enrollment.enrolledBy ? enrollment.enrolledBy.toString() : null,
    enrolledAt: enrollment.enrolledAt,
  };
}

export default Enrollment;