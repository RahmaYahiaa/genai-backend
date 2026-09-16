import mongoose from 'mongoose';
import {
  REMEDIAL_ORIGINS,
  REMEDIAL_CONTENT_TYPES,
  REMEDIAL_STATUSES,
  REMEDIAL_AUDIENCE_TYPES,
} from '../../config/constants.js';

const remedialContentSchema = new mongoose.Schema(
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
    topicId: { type: mongoose.Schema.Types.ObjectId, default: null },
    origin: {
      type: String,
      enum: Object.values(REMEDIAL_ORIGINS),
      required: true,
    },
    contentType: {
      type: String,
      enum: Object.values(REMEDIAL_CONTENT_TYPES),
      required: true,
    },
    misconceptionCode: { type: String, default: null, maxlength: 80 },
    misconceptionDescription: { type: String, default: null, maxlength: 500 },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 20000 },
    status: {
      type: String,
      enum: Object.values(REMEDIAL_STATUSES),
      default: REMEDIAL_STATUSES.DRAFT,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedAt: { type: Date, default: null },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    audienceType: {
      type: String,
      enum: [...Object.values(REMEDIAL_AUDIENCE_TYPES), null],
      default: null,
    },
    audienceStudentIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    sourcesUsed: { type: mongoose.Schema.Types.Mixed, default: {} },
    modelVersion: { type: String, default: null, maxlength: 100 },
    promptVersion: { type: String, default: null, maxlength: 50 },
  },
  { timestamps: true, versionKey: false },
);

const RemedialContent = mongoose.model('RemedialContent', remedialContentSchema);

export function toPublicRemedial(document) {
  return {
    id: document._id.toString(),
    courseId: document.courseId.toString(),
    assignmentId: document.assignmentId ? document.assignmentId.toString() : null,
    topicId: document.topicId ? document.topicId.toString() : null,
    origin: document.origin,
    contentType: document.contentType,
    misconceptionCode: document.misconceptionCode ?? null,
    misconceptionDescription: document.misconceptionDescription ?? null,
    title: document.title,
    body: document.body,
    status: document.status,
    createdBy: document.createdBy.toString(),
    publishedAt: document.publishedAt ?? null,
    publishedBy: document.publishedBy ? document.publishedBy.toString() : null,
    audienceType: document.audienceType ?? null,
    audienceStudentIds: (document.audienceStudentIds ?? []).map((studentId) =>
      studentId.toString(),
    ),
    sourcesUsed: document.sourcesUsed ?? {},
    modelVersion: document.modelVersion ?? null,
    promptVersion: document.promptVersion ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toPublicRemedialForStudent(document) {
  return {
    id: document._id.toString(),
    courseId: document.courseId.toString(),
    assignmentId: document.assignmentId ? document.assignmentId.toString() : null,
    topicId: document.topicId ? document.topicId.toString() : null,
    contentType: document.contentType,
    title: document.title,
    body: document.body,
    publishedAt: document.publishedAt,
  };
}

export default RemedialContent;