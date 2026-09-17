import mongoose from 'mongoose';
import { ASSIGNMENT_STATUS } from '../../config/constants.js';

const assignmentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.DRAFT,
      index: true,
    },
    showGradeToStudent: { type: Boolean, default: true },
    showFeedbackToStudent: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

assignmentSchema.index({ courseId: 1, status: 1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export function toPublicAssignment(assignment) {
  return {
    id: assignment._id.toString(),
    courseId: assignment.courseId.toString(),
    createdBy: assignment.createdBy.toString(),
    title: assignment.title,
    status: assignment.status,
    showGradeToStudent: assignment.showGradeToStudent,
    showFeedbackToStudent: Boolean(assignment.showFeedbackToStudent),
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

export default Assignment;