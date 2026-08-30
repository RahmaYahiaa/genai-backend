/**
 * Deterministic offline embedding provider (development/test only).
 *
 * Produces stable vectors without any network call: unigram bag-of-words
 * hashed into a fixed-dimension vector with FNV-1a, then L2-normalized so
 * cosine similarity works. Texts sharing words get higher similarity, which
 * is enough to exercise retrieval logic in tests. Swapped by the real
 * provider via EMBEDDING_PROVIDER in production.
 */

// FNV-1a 32-bit string hash - stable across processes, no crypto needed.
function fnv1aHash(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createStubEmbeddingProvider({ dimensions, modelName }) {
  return {
    name: 'stub',
    model: modelName,
    dimensions,

    async embed(texts) {
      return texts.map((text) => {
        const vector = new Array(dimensions).fill(0);
        const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
        for (const token of tokens) {
          vector[fnv1aHash(token) % dimensions] += 1;
        }
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (norm > 0) {
          for (let i = 0; i < dimensions; i += 1) {
            vector[i] /= norm;
          }
        }
        return vector;
      });
    },
  };
}