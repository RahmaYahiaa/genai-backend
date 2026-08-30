import { embeddingProvider } from '../../ai/embeddings/index.js';
import { materialChunkRepository } from '../knowledge/index.js';
import { createRetrievalService } from './retrieval.service.js';

export { createRetrievalService };

// Composition root (manual DI): the trusted retrieval shared by the AI tutor
// now and by future AI surfaces (teaching assistant, content generation).
export const retrievalService = createRetrievalService({
  embeddingProvider,
  materialChunkRepository,
});