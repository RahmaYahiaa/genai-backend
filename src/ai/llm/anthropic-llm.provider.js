/**
 * Anthropic Claude adapter (production).
 *
 * Wraps the Messages API behind the same interface as the stub provider:
 * `completeJson({ task, system, user }) -> object`. `task` is metadata for
 * logging/stubs only; the real call always uses system+user prompts. The
 * parsed JSON is validated with Zod at the service boundary; transport or
 * format failures surface as AiProviderError (502) without leaking internals.
 */

import { AiProviderError } from '../../shared/errors/index.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function extractJson(text) {
  const withoutFences = text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new AiProviderError('LLM provider returned a non-JSON response');
  }
  try {
    return JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    throw new AiProviderError('LLM provider returned invalid JSON');
  }
}

export function createAnthropicLlmProvider({ apiKey, model, maxTokens }) {
  if (!apiKey) {
    throw new AiProviderError(
      'LLM provider is not configured: set ANTHROPIC_API_KEY or switch LLM_PROVIDER=stub',
    );
  }

  const fetchFn = globalThis.fetch?.bind(globalThis);

  return {
    name: 'anthropic',
    model,

    async completeJson({ system, user }) {
      if (!fetchFn) {
        throw new AiProviderError('LLM provider request failed: fetch is not available in this runtime');
      }

      let response;
      try {
        response = await fetchFn(ANTHROPIC_ENDPOINT, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        });
      } catch {
        throw new AiProviderError('LLM provider request failed');
      }

      if (!response.ok) {
        throw new AiProviderError(`LLM provider returned status ${response.status}`);
      }

      const payload = await response.json();
      const text = (payload?.content ?? [])
        .filter((block) => block?.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return extractJson(text);
    },
  };
}