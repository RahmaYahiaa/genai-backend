import mongoose from 'mongoose';
import { AUDIT_ACTIONS } from '../../config/constants.js';

const auditLogSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      default: null,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true,
    },
    aiOriginalScore: { type: Number, default: null, min: 0, max: 1000 },
    finalScore: { type: Number, default: null, min: 0, max: 1000 },
    reasonText: { type: String, default: null, maxlength: 2000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export function toPublicAuditLog(entry) {
  return {
    id: entry._id.toString(),
    courseId: entry.courseId.toString(),
    assignmentId: entry.assignmentId ? entry.assignmentId.toString() : null,
    submissionId: entry.submissionId ? entry.submissionId.toString() : null,
    actorId: entry.actorId.toString(),
    action: entry.action,
    aiOriginalScore: entry.aiOriginalScore ?? null,
    finalScore: entry.finalScore ?? null,
    reasonText: entry.reasonText ?? null,
    metadata: entry.metadata ?? {},
    createdAt: entry.createdAt,
  };
}

export default AuditLog;