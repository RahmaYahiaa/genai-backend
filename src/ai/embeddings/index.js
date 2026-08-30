/**
 * Embedding provider factory (Strategy pattern). The rest of the codebase
 * only depends on the interface: { name, model, dimensions, embed(texts) }.
 * Select the implementation with EMBEDDING_PROVIDER (stub | voyage).
 */

import { AiProviderError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { createStubEmbeddingProvider } from './stub-embedding.provider.js';
import { createVoyageEmbeddingProvider } from './voyage-embedding.provider.js';

function createLocalStub({ dimensions }) {
  // The stub records its own model name so stored chunks are never
  // mistaken for vectors produced by the real vendor model.
  return createStubEmbeddingProvider({ dimensions, modelName: `stub-hash-${dimensions}` });
}

export function createEmbeddingProvider(overrides = {}) {
  const provider = overrides.provider ?? config.ai.embeddingProvider;
  const model = overrides.model ?? config.ai.embeddingModel;
  const dimensions = overrides.dimensions ?? config.ai.embeddingDimensions;

  if (provider === 'stub') {
    return createLocalStub({ dimensions });
  }
  if (provider === 'voyage') {
    const apiKey = overrides.apiKey ?? config.ai.embeddingApiKey;
    if (!apiKey) {
      if (config.isProduction) {
        // Production misconfiguration must fail fast at boot.
        throw new AiProviderError(
          'Embedding provider is not configured: set VOYAGE_API_KEY or switch EMBEDDING_PROVIDER=stub',
        );
      }
      // Development/test convenience: boot on deterministic offline vectors
      // instead of crashing, and say so loudly in the logs.
      logger.warn(
        'EMBEDDING_PROVIDER=voyage but VOYAGE_API_KEY is empty; using deterministic stub embeddings. Set VOYAGE_API_KEY or EMBEDDING_PROVIDER=stub to silence this warning.',
      );
      return createLocalStub({ dimensions });
    }
    return createVoyageEmbeddingProvider({ apiKey, model, dimensions });
  }
  throw new AiProviderError(`Unknown embedding provider "${provider}"`);
}

// Default singleton used by module composition roots (manual DI).
export const embeddingProvider = createEmbeddingProvider();