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
      'LLM provider is not configured: set GROQ_API_KEY (or OPENROUTER_API_KEY) in your .env',
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

  // Groq's free tier also has a per-model daily token budget. When the main
  // model hits it, the same key can still use the other models (each has its
  // own budget), so the answer does not fail for the rest of the day.
  const exhaustedUntil = new Map();
  function parseRetryMs(text) {
    const m = /try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(text ?? '');
    if (!m) return 10 * 60_000;
    return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000 + 1000;
  }
  async function groqCandidates() {
    const first = await resolveGroqModel();
    const available = await availableGroqModels();
    const list = [first, ...GROQ_PREFERRED_MODELS.filter((m) => m !== first && (!available || available.has(m)))];
    const now = Date.now();
    const fresh = list.filter((m) => (exhaustedUntil.get(m) ?? 0) <= now);
    return fresh.length ? fresh : [first];
  }

  async function callGroq(system, user) {
    const candidates = await groqCandidates();
    let lastError;
    for (const model of candidates) {
      try {
        return await callGroqModel(model, system, user);
      } catch (error) {
        lastError = error;
        if (!error.dailyLimit) throw error;
        exhaustedUntil.set(model, Date.now() + error.retryMs);
      }
    }
    throw lastError;
  }

  async function callGroqModel(model, system, user) {
    const post = async (temperature) => {
      try {
        return await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${groqApiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
          // A stalled request must not hang the student's page forever.
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        throw new AiProviderError('LLM provider request failed');
      }
    };
    let response = await post(0.3);
    // groq's free tier answers 429 under burst load: wait as long as Groq asks
    // (Retry-After), capped so one request never blocks for minutes, and give
    // up after a bounded total wait so the caller can fall back or report.
    let waited = 0;
    for (let attempt = 0; attempt < 4 && response.status === 429; attempt += 1) {
      // A daily budget will not free up in seconds: switch model right away.
      const peek = await response.clone().text().catch(() => '');
      if (/per day/i.test(peek)) break;
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt, 15_000);
      if (waited + delay > 30_000) break;
      await sleep(delay);
      waited += delay;
      response = await post(0.2);
    }
    if (!response.ok) {
      resolvedModel = null;
      const body = await response.text().catch(() => '');
      const detail = body.slice(0, 300);
      const error = new AiProviderError(`LLM provider returned status ${response.status} (${model})${detail ? `: ${detail}` : ''}`);
      if (response.status === 429 && /per day/i.test(body)) {
        error.dailyLimit = true;
        error.retryMs = parseRetryMs(body);
      }
      throw error;
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
        signal: AbortSignal.timeout(60_000),
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