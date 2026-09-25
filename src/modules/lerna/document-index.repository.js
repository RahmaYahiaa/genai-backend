import mongoose from 'mongoose';

/**
 * Per-(user, material) LeRna document index. LeRna indexes uploaded documents
 * per student id, while our materials belong to courses; this bridge records
 * the LeRna document_id produced for each student copy so scoped (Mode A)
 * retrieval can pass the exact document_ids LeRna expects. No duplication is
 * needed between students: indexing is lazy, on first scoped use.
 */
const lernaDocumentIndexSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    documentId: { type: String, required: true, maxlength: 120 },
    courseCode: { type: String, default: null, maxlength: 60 },
    status: { type: String, enum: ['indexed', 'failed'], default: 'indexed' },
    lastError: { type: String, default: null, maxlength: 400 },
  },
  { timestamps: true, collection: 'lerna_document_index' },
);

lernaDocumentIndexSchema.index({ userId: 1, materialId: 1 }, { unique: true });

const LernaDocumentIndex = mongoose.model('LernaDocumentIndex', lernaDocumentIndexSchema);

export default LernaDocumentIndex;

export async function findIndexedCopy(userId, materialId) {
  return LernaDocumentIndex.findOne({ userId, materialId, status: 'indexed' }).lean();
}

export async function recordIndexedCopy({ userId, materialId, documentId, courseCode }) {
  return LernaDocumentIndex.findOneAndUpdate(
    { userId, materialId },
    { documentId, courseCode, status: 'indexed', lastError: null },
    { upsert: true, new: true, returnDocument: 'after' },
  ).lean();
}

export async function recordIndexFailure({ userId, materialId, error }) {
  return LernaDocumentIndex.findOneAndUpdate(
    { userId, materialId },
    {
      documentId: `failed-${materialId}`,
      status: 'failed',
      lastError: String(error?.message ?? error).slice(0, 400),
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();
}
