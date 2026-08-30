import { RETRIEVAL_SETTINGS } from '../../config/constants.js';

function toContext(row) {
  const text = row.chunk.text;
  const snippet =
    text.length > RETRIEVAL_SETTINGS.SNIPPET_LENGTH
      ? `${text.slice(0, RETRIEVAL_SETTINGS.SNIPPET_LENGTH)}...`
      : text;
  return {
    chunkId: row.chunk.id,
    materialId: row.chunk.materialId,
    order: row.chunk.order,
    text,
    snippet,
    score: Math.round(row.score * 1000) / 1000,
  };
}

/**
 * Trusted-context retrieval (RAG foundation). Search runs ONLY against the
 * target course's material chunks (the courseId filter is applied inside the
 * vector search itself), so institutional and personal scopes can never leak
 * into each other. Chunks scoring below MIN_SCORE are treated as noise, not
 * evidence - callers gate on `contexts.length === 0` and surface an explicit
 * "insufficient evidence" response instead of answering ungrounded.
 */
export function createRetrievalService({ embeddingProvider, materialChunkRepository }) {
  async function retrieveContext({ courseId, query, topK = RETRIEVAL_SETTINGS.TOP_K }) {
    const [queryVector] = await embeddingProvider.embed([query]);
    const rows = await materialChunkRepository.vectorSearch({
      courseId,
      queryVector,
      topK,
    });
    const contexts = rows.filter((row) => row.score >= RETRIEVAL_SETTINGS.MIN_SCORE).map(toContext);
    return { contexts, topScore: contexts.length > 0 ? contexts[0].score : 0 };
  }

  return { retrieveContext };
}