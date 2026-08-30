import mongoose from 'mongoose';
import { MATERIAL_SOURCE_TYPES, MATERIAL_STATUSES } from '../../config/constants.js';

/**
 * A trusted course material uploaded into a course's knowledge base.
 * - institutional courses: uploaded by the institution admin/course staff;
 *   these are the trusted sources institutional students learn from.
 * - personal courses: uploaded by the individual learner owning the space.
 *
 * The raw uploaded text is not stored on the material itself; it lives in
 * material_chunks (chunked + embedded) so every retrieval/evidence item can
 * point at a concrete chunk.
 */
const materialSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    // Denormalized tenancy scope (null for personal learning spaces).
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    isPersonal: { type: Boolean, default: false },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    sourceType: {
      type: String,
      enum: Object.values(MATERIAL_SOURCE_TYPES),
      required: true,
    },
    mimeType: { type: String, default: 'text/plain' },
    sizeChars: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: Object.values(MATERIAL_STATUSES),
      default: MATERIAL_STATUSES.PROCESSING,
    },
    // Set when status=failed; never leaks provider internals.
    statusError: { type: String, default: null },
    chunkCount: { type: Number, default: 0, min: 0 },
    extractionProvider: { type: String, default: null },
    embeddingModel: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

materialSchema.index({ courseId: 1, createdAt: -1 });

const Material = mongoose.model('Material', materialSchema);

/** Maps a lean material document to the public API shape. */
export function toPublicMaterial(material) {
  return {
    id: material._id.toString(),
    courseId: material.courseId.toString(),
    institutionId: material.institutionId ? material.institutionId.toString() : null,
    isPersonal: Boolean(material.isPersonal),
    uploadedBy: material.uploadedBy.toString(),
    title: material.title,
    sourceType: material.sourceType,
    mimeType: material.mimeType,
    sizeChars: material.sizeChars ?? 0,
    status: material.status,
    statusError: material.statusError ?? null,
    chunkCount: material.chunkCount ?? 0,
    extractionProvider: material.extractionProvider ?? null,
    embeddingModel: material.embeddingModel ?? null,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export default Material;