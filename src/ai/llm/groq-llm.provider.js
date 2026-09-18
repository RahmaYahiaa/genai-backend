import { AiProviderError } from '../../shared/errors/index.js';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_ENDPOINT = 'https://api.groq.com/openai/v1/models';
const OPENROUTER_402_COOLDOWN_MS = 10 * 60 * 1000;
const GROQ_MODEL_CACHE_MS = 10 * 60 * 1000;
// Fallback order when the configured model is not served anymore (Groq
// deprecates models regularly). Mirrors the reference integration client.
const GROQ_PREFERRED_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
];

function extractJson(text) {
  const withoutFences = String(text)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new AiProviderError('LLM provider returned a non-JSON response');
  }
  const candidate = withoutFences.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new AiProviderError('LLM provider returned invalid JSON');
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGroqLlmProvider({
  groqApiKey,
  groqModel,
  maxTokens,
  openrouterApiKey,
  openrouterModel,
  openrouterBaseUrl,
}) {
  if (!groqApiKey && !openrouterApiKey) {
    throw new AiProviderError(
      'LLM provider is not configured: set GROQ_API_KEY (or OPENROUTER_API_KEY) or switch LLM_PROVIDER=stub',
    );
  }

  let openrouterCooldownUntil = 0;
  let cachedModels = null;
  let cachedModelsAt = 0;
  let resolvedModel = null;

  async function availableGroqModels() {
    if (cachedModels && Date.now() - cachedModelsAt < GROQ_MODEL_CACHE_MS) {
      return cachedModels;
    }
    try {
      const response = await fetch(GROQ_MODELS_ENDPOINT, {
        headers: { authorization: `Bearer ${groqApiKey}` },
      });
      if (response.ok) {
        const payload = await response.json();
        cachedModels = new Set((payload?.data ?? []).map((entry) => entry?.id).filter(Boolean));
        cachedModelsAt = Date.now();
      }
    } catch {
      // discovery is best-effort; the configured model is used as-is
    }
    return cachedModels;
  }

  async function resolveGroqModel() {
    if (resolvedModel) {
      return resolvedModel;
    }
    const available = await availableGroqModels();
    if (!available) {
      return groqModel;
    }
    if (available.has(groqModel)) {
      resolvedModel = groqModel;
      return resolvedModel;
    }
    for (const candidate of GROQ_PREFERRED_MODELS) {
      if (available.has(candidate)) {
        resolvedModel = candidate;
        return resolvedModel;
      }
    }
    return groqModel;
  }

  async function callGroq(system, user) {
    const model = await resolveGroqModel();
    let response;
    try {
      response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${groqApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch {
      throw new AiProviderError('LLM provider request failed');
    }
    // groq's free tier answers 429 under burst load (seeding, bulk grading):
    // back off exponentially instead of failing the caller
    for (let attempt = 0; attempt < 5 && response.status === 429; attempt += 1) {
      await sleep(5000 * 2 ** attempt);
      try {
        response = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${groqApiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });
      } catch {
        throw new AiProviderError('LLM provider request failed');
      }
    }
    if (!response.ok) {
      resolvedModel = null;
      throw new AiProviderError(`LLM provider returned status ${response.status}`);
    }
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content ?? '';
  }

  async function callOpenRouter(system, user) {
    if (Date.now() < openrouterCooldownUntil) {
      throw new AiProviderError('openrouter skipped (insufficient credits cooldown)');
    }
    let response;
    try {
      response = await fetch(`${openrouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${openrouterApiKey}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://edunation.app',
          'X-Title': 'GenAI Backend',
        },
        body: JSON.stringify({
          model: openrouterModel,
          max_tokens: maxTokens,
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch {
      throw new AiProviderError('LLM provider request failed');
    }
    if (response.status === 402) {
      openrouterCooldownUntil = Date.now() + OPENROUTER_402_COOLDOWN_MS;
      throw new AiProviderError('openrouter 402 insufficient credits');
    }
    if (!response.ok) {
      throw new AiProviderError(`LLM provider returned status ${response.status}`);
    }
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content ?? '';
  }

  function normalizePrompt({ system, user, payload }) {
    const systemText =
      typeof system === 'string' && system.trim()
        ? system
        : 'You are an academic assistant. Respond with valid JSON only.';
    let userText = typeof user === 'string' && user.trim() ? user : '';
    if (!userText && payload) {
      userText = JSON.stringify(payload);
    }
    if (!userText) {
      throw new AiProviderError('LLM request is missing its user prompt');
    }
    return { systemText, userText };
  }

  return {
    name: 'groq',
    get model() {
      return resolvedModel ?? groqModel;
    },

    async completeJson(prompt) {
      const { systemText, userText } = normalizePrompt(prompt);
      const errors = [];
      if (groqApiKey) {
        try {
          return extractJson(await callGroq(systemText, userText));
        } catch (error) {
          errors.push(`groq: ${error?.message ?? 'failed'}`);
        }
      }
      if (openrouterApiKey) {
        try {
          return extractJson(await callOpenRouter(systemText, userText));
        } catch (error) {
          errors.push(`openrouter: ${error?.message ?? 'failed'}`);
        }
      }
      throw new AiProviderError(
        `All LLM providers failed: ${errors.join(' | ') || 'none configured'}`,
      );
    },
  };
}