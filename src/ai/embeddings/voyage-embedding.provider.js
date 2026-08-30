/**
 * Voyage AI embedding adapter (production).
 *
 * Wraps the vendor REST API behind the same interface as the stub provider:
 * `embed(texts) -> number[][]` with a fixed dimension matching the Atlas
 * Vector Search index. Provider internals are never leaked to clients;
 * failures surface as AiProviderError (502).
 */

import { fetch } from 'undici';
import { AiProviderError } from '../../shared/errors/index.js';

const VOYAGE_ENDPOINT = 'https://api.voyageai.com/api/v1/embeddings';

export function createVoyageEmbeddingProvider({ apiKey, model, dimensions }) {
  if (!apiKey) {
    throw new AiProviderError(
      'Embedding provider is not configured: set VOYAGE_API_KEY or switch EMBEDDING_PROVIDER=stub',
    );
  }

  return {
    name: 'voyage',
    model,
    dimensions,

    async embed(texts) {
      let response;
      try {
        response = await fetch(VOYAGE_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model, input: texts, truncation: true }),
        });
      } catch {
        throw new AiProviderError('Embedding provider request failed');
      }

      if (!response.ok) {
        throw new AiProviderError(`Embedding provider returned status ${response.status}`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload?.data) || payload.data.length !== texts.length) {
        throw new AiProviderError('Embedding provider returned an unexpected payload');
      }
      return payload.data.map((item) => item.embedding);
    },
  };
}