import mongoose from 'mongoose';
import { ENROLLMENT_REQUEST_STATUSES } from '../../config/constants.js';

/**
 * A student's ask to join an institutional course. The institution admin is
 * the single gate: approving the request creates the enrollment, rejecting it
 * records why. One lifetime request per student per course (a rejected
 * request can only be overridden by a manual admin enrollment) so the queue
 * stays clean and the answer is always traceable.
 */
const enrollmentRequestSchema = new mongoose.Schema(
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
    // Denormalized tenancy scope for institution-scoped admin queues.
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ENROLLMENT_REQUEST_STATUSES),
      default: ENROLLMENT_REQUEST_STATUSES.PENDING,
    },
    studentNote: { type: String, trim: true, maxlength: 500, default: null },
    proof: {
      fileName: { type: String, trim: true, maxlength: 200 },
      mimeType: { type: String, trim: true, maxlength: 100 },
      size: { type: Number, min: 0 },
      data: { type: String, select: false },
    },
    decisionNote: { type: String, trim: true, maxlength: 500, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

enrollmentRequestSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrollmentRequestSchema.index({ institutionId: 1, status: 1, createdAt: -1 });

const EnrollmentRequest = mongoose.model('EnrollmentRequest', enrollmentRequestSchema);

/** Maps a lean request document to the public API shape. */
export function toPublicEnrollmentRequest(request) {
  return {
    id: request._id.toString(),
    studentId: request.studentId?._id
      ? request.studentId._id.toString()
      : request.studentId.toString(),
    courseId: request.courseId?._id ? request.courseId._id.toString() : request.courseId.toString(),
    institutionId: request.institutionId ? request.institutionId.toString() : null,
    status: request.status,
    studentNote: request.studentNote ?? null,
    proofFileName: request.proof?.fileName ?? null,
    proofMimeType: request.proof?.mimeType ?? null,
    hasProof: Boolean(request.proof?.fileName),
    decisionNote: request.decisionNote ?? null,
    decidedBy: request.decidedBy ? request.decidedBy.toString() : null,
    decidedAt: request.decidedAt ?? null,
    student: request.studentId?.firstName
      ? {
          id: request.studentId._id.toString(),
          firstName: request.studentId.firstName,
          lastName: request.studentId.lastName,
          email: request.studentId.email,
        }
      : undefined,
    course: request.courseId?.title
      ? {
          id: request.courseId._id.toString(),
          title: request.courseId.title,
          code: request.courseId.code ?? null,
        }
      : undefined,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export default EnrollmentRequest;