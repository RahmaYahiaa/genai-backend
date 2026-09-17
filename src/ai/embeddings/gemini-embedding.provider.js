import { AiProviderError } from '../../shared/errors/index.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_TEXT_CHARS = 8000;

export function createGeminiEmbeddingProvider({ apiKey, model, dimensions }) {
  if (!apiKey) {
    throw new AiProviderError(
      'Embedding provider is not configured: set GEMINI_API_KEY or switch EMBEDDING_PROVIDER=stub',
    );
  }

  async function post(action, body) {
    let response;
    try {
      response = await fetch(`${GEMINI_BASE_URL}/models/${model}:${action}`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AiProviderError('Embedding provider request failed');
    }
    if (!response.ok) {
      throw new AiProviderError(`Embedding provider returned status ${response.status}`);
    }
    return response.json();
  }

  function singleRequest(text) {
    return {
      model: `models/${model}`,
      content: { parts: [{ text }] },
      outputDimensionality: dimensions,
    };
  }

  return {
    name: 'gemini',
    model,
    dimensions,

    async embed(texts) {
      if (!Array.isArray(texts) || texts.length === 0) {
        return [];
      }
      const trimmed = texts.map((text) => String(text).slice(0, MAX_TEXT_CHARS));
      try {
        const payload = await post('batchEmbedContents', {
          requests: trimmed.map(singleRequest),
        });
        const vectors = (payload?.embeddings ?? []).map((entry) => entry?.values ?? []);
        if (vectors.length !== trimmed.length || vectors.some((vector) => vector.length === 0)) {
          throw new AiProviderError('Embedding provider returned an incomplete batch');
        }
        return vectors;
      } catch {
        const vectors = await Promise.all(
          trimmed.map(async (text) => {
            const payload = await post('embedContent', singleRequest(text));
            return payload?.embedding?.values ?? [];
          }),
        );
        if (vectors.some((vector) => vector.length === 0)) {
          throw new AiProviderError('Embedding provider returned an empty vector');
        }
        return vectors;
      }
    },
  };
}