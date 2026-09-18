/**
 * LLM provider factory (Strategy pattern). The rest of the codebase only
 * depends on the interface: `completeJson({ task, system, user }) -> object`.
 * Every LLM output must pass Zod validation at the service boundary, and
 * models never compute mastery - they only classify/produce content that our
 * deterministic rules consume.
 */

import { AiProviderError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import { createAnthropicLlmProvider } from './anthropic-llm.provider.js';
import { createGroqLlmProvider } from './groq-llm.provider.js';

export function createLlmProvider(overrides = {}) {
  const provider = overrides.provider ?? config.ai.llmProvider;

  if (provider === 'groq') {
    const groqApiKey = overrides.apiKey ?? config.ai.groqApiKey;
    const openrouterApiKey = overrides.openrouterApiKey ?? config.ai.openrouterApiKey;
    if (!groqApiKey && !openrouterApiKey) {
      throw new AiProviderError(
        'LLM provider is not configured: set GROQ_API_KEY (or OPENROUTER_API_KEY) in your .env',
      );
    }
    return createGroqLlmProvider({
      groqApiKey,
      groqModel: config.ai.groqModel,
      maxTokens: config.ai.groqMaxTokens,
      openrouterApiKey,
      openrouterModel: config.ai.openrouterModel,
      openrouterBaseUrl: config.ai.openrouterBaseUrl,
    });
  }
  if (provider === 'anthropic') {
    const apiKey = overrides.apiKey ?? config.ai.anthropicApiKey;
    if (!apiKey) {
      throw new AiProviderError(
        'LLM provider is not configured: set ANTHROPIC_API_KEY in your .env',
      );
    }
    return createAnthropicLlmProvider({
      apiKey,
      model: config.ai.anthropicModel,
      maxTokens: config.ai.anthropicMaxTokens,
    });
  }
  throw new AiProviderError(`Unknown LLM provider "${provider}"`);
}

// Default singleton used by module composition roots (manual DI).
export const llmProvider = createLlmProvider();