import MaterialChunk, { toPublicChunk } from './material-chunk.model.js';
import { config } from '../../config/index.js';
import { cosineSimilarity } from '../../shared/math/vector-math.js';

export async function insertManyChunks(docs) {
  return MaterialChunk.insertMany(docs);
}

export async function deleteByMaterialId(materialId) {
  await MaterialChunk.deleteMany({ materialId });
}

export async function countByMaterial(materialId) {
  return MaterialChunk.countDocuments({ materialId });
}

export async function listByMaterial(materialId, { skip, limit }) {
  const [items, total] = await Promise.all([
    MaterialChunk.find({ materialId }).sort({ order: 1 }).skip(skip).limit(limit).lean(),
    MaterialChunk.countDocuments({ materialId }),
  ]);
  return { items, total };
}

// Set once the Atlas $vectorSearch attempt fails (auto mode): fall back to
// in-process cosine scan for the rest of the process lifetime.
let atlasUnavailable = false;

/**
 * Vector similarity search over course chunks.
 * - `atlas`: $vectorSearch against the Atlas Vector Search index.
 * - `fallback`: exact cosine scan in-process (development / in-memory Mongo).
 * - `auto` (default): try Atlas once, fall back permanently on failure.
 *
 * Returns [{ chunk, score }] sorted by score desc, embedding stripped.
 */
export async function vectorSearch({ courseId, queryVector, topK }) {
  const mode = config.vector.searchMode;
  const filter = { courseId };

  if (!atlasUnavailable && mode !== 'fallback') {
    try {
      const results = await MaterialChunk.aggregate([
        {
          $vectorSearch: {
            index: config.vector.atlasIndexName,
            path: 'embedding',
            queryVector,
            numCandidates: Math.max(topK * 10, 100),
            limit: topK,
            filter,
          },
        },
        {
          $project: {
            materialId: 1,
            courseId: 1,
            order: 1,
            text: 1,
            charCount: 1,
            embeddingModel: 1,
            embeddingDim: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);
      return results.map((doc) => ({
        chunk: toPublicChunk({ ...doc, _id: doc._id }),
        score: doc.score ?? 0,
      }));
    } catch (error) {
      if (mode === 'atlas') throw error;
      atlasUnavailable = true;
    }
  }

  const candidates = await MaterialChunk.find(filter).select('+embedding').lean();
  return candidates
    .map((chunk) => ({
      chunk: toPublicChunk(chunk),
      score: cosineSimilarity(queryVector, chunk.embedding ?? []),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export { toPublicChunk };
