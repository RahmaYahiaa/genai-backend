import mongoose from 'mongoose';

/**
 * A chunk of course material with its embedding vector. This is the unit of
 * trusted retrieval for RAG and the anchor every evidence/grounding reference
 * points to (chunkId), keeping generated text and supporting evidence
 * separated and traceable.
 *
 * `embedding` is select:false so vectors never leak into normal queries or
 * API responses; vector search opts back in explicitly.
 */
const materialChunkSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    order: { type: Number, required: true, min: 0 },
    text: { type: String, required: true },
    charCount: { type: Number, required: true, min: 0 },
    embedding: { type: [Number], select: false, required: true },
    embeddingModel: { type: String, required: true },
    embeddingDim: { type: Number, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

materialChunkSchema.index({ courseId: 1, order: 1 });
materialChunkSchema.index({ materialId: 1, order: 1 });

const MaterialChunk = mongoose.model('MaterialChunk', materialChunkSchema);

/** Maps a lean chunk to the public shape (embedding never included). */
export function toPublicChunk(chunk) {
  return {
    id: chunk._id.toString(),
    materialId: chunk.materialId.toString(),
    courseId: chunk.courseId.toString(),
    order: chunk.order,
    text: chunk.text,
    charCount: chunk.charCount ?? chunk.text.length,
    embeddingModel: chunk.embeddingModel,
    embeddingDim: chunk.embeddingDim,
  };
}

export default MaterialChunk;