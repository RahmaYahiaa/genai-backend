import mongoose from 'mongoose';

/**
 * A generated learning resource (EDUNation "Study Tools" parity). Owns one
 * generated artifact per kind for one student (or instructor studio draft)
 * on one course. Text kinds keep their structured content inline; file kinds
 * (diagram/presentation) point at a real artifact on disk. Media kinds we
 * cannot produce honestly are persisted as `unavailable` - never faked.
 */
const generatedResourceSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    language: {
      type: String,
      enum: ['en', 'ar', 'fr', 'sw', 'ha', 'am', 'so', 'yo', 'ig', 'zu'],
      default: 'en',
    },
    kind: {
      type: String,
      enum: [
        'summary',
        'notes',
        'flashcards',
        'quiz',
        'code',
        'diagram',
        'presentation',
        'explanation',
        'study_guide',
        'coding_exercise',
        'analogy',
        'comparison',
        'exam',
        'practice',
        'question_bank',
        'image',
        'audio',
        'video',
      ],
      required: true,
    },
    status: { type: String, enum: ['ready', 'unavailable'], required: true },
    // Structured content for text kinds (validated per kind before save).
    content: { type: mongoose.Schema.Types.Mixed, default: null },
    artifactPath: { type: String, default: null },
    mime: { type: String, default: null, maxlength: 100 },
    unavailableReason: { type: String, default: null, maxlength: 500 },
    // Which evidence grounded the generation (course material or trusted web).
    knowledgeSource: {
      type: String,
      enum: ['uploaded_material', 'trusted_external', 'none'],
      default: 'none',
    },
    model: { type: String, default: null, maxlength: 120 },
    batchId: { type: String, required: true, maxlength: 40 },
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    isPersonal: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

generatedResourceSchema.index({ courseId: 1, userId: 1, createdAt: -1 });
generatedResourceSchema.index({ userId: 1, batchId: 1 });

const GeneratedResource = mongoose.model('GeneratedResource', generatedResourceSchema);

export function toPublicResource(doc) {
  return {
    id: doc._id.toString(),
    courseId: doc.courseId.toString(),
    // Owner id lets clients double-check that a list only holds the caller's own items.
    userId: doc.userId ? doc.userId.toString() : null,
    topic: doc.topic,
    language: doc.language,
    kind: doc.kind,
    status: doc.status,
    content: doc.content ?? null,
    hasArtifact: Boolean(doc.artifactPath),
    mime: doc.mime ?? null,
    unavailableReason: doc.unavailableReason ?? null,
    knowledgeSource: doc.knowledgeSource ?? 'none',
    model: doc.model ?? null,
    batchId: doc.batchId,
    createdAt: doc.createdAt,
  };
}

export default GeneratedResource;
