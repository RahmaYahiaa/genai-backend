/**
 * Embedding provider factory (Strategy pattern). The rest of the codebase
 * only depends on the interface: { name, model, dimensions, embed(texts) }.
 * Select the implementation with EMBEDDING_PROVIDER (gemini).
 */

import { AiProviderError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import { createGeminiEmbeddingProvider } from './gemini-embedding.provider.js';

export function createEmbeddingProvider(overrides = {}) {
  const provider = overrides.provider ?? config.ai.embeddingProvider;
  const dimensions = overrides.dimensions ?? config.ai.embeddingDimensions;

  if (provider === 'gemini') {
    const apiKey = overrides.apiKey ?? config.ai.geminiApiKey;
    if (!apiKey) {
      throw new AiProviderError(
        'Embedding provider is not configured: set GEMINI_API_KEY in your .env',
      );
    }
    return createGeminiEmbeddingProvider({
      apiKey,
      model: overrides.model ?? config.ai.geminiEmbedModel,
      dimensions,
    });
  }
  throw new AiProviderError(`Unknown embedding provider "${provider}"`);
}

// Default singleton used by module composition roots (manual DI).
export const embeddingProvider = createEmbeddingProvider();