import mongoose from 'mongoose';
import { COURSE_STAFF_ROLES } from '../../config/constants.js';

const learningObjectiveSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, maxlength: 30, default: null },
    description: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: true },
);

const topicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000, default: null },
    // Display/teaching order within the course.
    order: { type: Number, default: 0, min: 0 },
    learningObjectives: { type: [learningObjectiveSchema], default: [] },
    // Prerequisites restricted to sibling topics of the same course, which
    // keeps the future knowledge graph cheap and locally consistent.
    prerequisiteTopicIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { _id: true },
);

const staffMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(COURSE_STAFF_ROLES),
      required: true,
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

/**
 * Two course kinds:
 * - institutional: owned by a tenant, managed by its admin and course staff,
 *   with enrollments tracking its students.
 * - personal: an individual learner's private learning space (institutionId
 *   is null, ownerId is the learner, no staff/enrollments).
 *
 * Topics (with learning objectives and prerequisites) are embedded because
 * they are always read/written together with the course and give every
 * diagnostic/content/evidence item a stable courseId+topicId address.
 */
const courseSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    isPersonal: { type: Boolean, default: false },
    // Owner for personal courses; null for institutional ones.
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, trim: true, uppercase: true, maxlength: 30, default: null },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicUnit', default: null },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicUnit', default: null },
    topics: { type: [topicSchema], default: [] },
    // Institutional courses only.
    staff: { type: [staffMemberSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Course code is unique within an institution; personal courses (no code) are skipped.
courseSchema.index({ institutionId: 1, code: 1 }, { unique: true, sparse: true });
courseSchema.index({ ownerId: 1 });
courseSchema.index({ 'staff.userId': 1 });

const Course = mongoose.model('Course', courseSchema);

/** Maps a lean course document to the public API shape. */
export function toPublicCourse(course) {
  return {
    id: course._id.toString(),
    institutionId: course.institutionId ? course.institutionId.toString() : null,
    isPersonal: Boolean(course.isPersonal),
    ownerId: course.ownerId ? course.ownerId.toString() : null,
    title: course.title,
    code: course.code ?? null,
    description: course.description ?? null,
    departmentId: course.departmentId ? course.departmentId.toString() : null,
    semesterId: course.semesterId ? course.semesterId.toString() : null,
    topics: (course.topics ?? []).map((topic) => ({
      id: topic._id.toString(),
      title: topic.title,
      description: topic.description ?? null,
      order: topic.order ?? 0,
      learningObjectives: (topic.learningObjectives ?? []).map((objective) => ({
        id: objective._id.toString(),
        code: objective.code ?? null,
        description: objective.description,
      })),
      prerequisiteTopicIds: (topic.prerequisiteTopicIds ?? []).map((id) => id.toString()),
    })),
    staff: (course.staff ?? []).map((member) => ({
      userId: member.userId.toString(),
      role: member.role,
      addedBy: member.addedBy ? member.addedBy.toString() : null,
      addedAt: member.addedAt,
    })),
    createdBy: course.createdBy ? course.createdBy.toString() : null,
    isActive: course.isActive,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

export default Course;