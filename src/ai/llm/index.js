/**
 * LLM provider factory (Strategy pattern). The rest of the codebase only
 * depends on the interface: `completeJson({ task, system, user }) -> object`.
 * Every LLM output must pass Zod validation at the service boundary, and
 * models never compute mastery - they only classify/produce content that our
 * deterministic rules consume.
 */

import { AiProviderError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { createStubLlmProvider } from './stub-llm.provider.js';
import { createAnthropicLlmProvider } from './anthropic-llm.provider.js';

function createLocalStub() {
  // The stub records its own model name so evaluations stay auditable.
  return createStubLlmProvider({ modelName: 'stub-rules-v1' });
}

export function createLlmProvider(overrides = {}) {
  const provider = overrides.provider ?? config.ai.llmProvider;

  if (provider === 'stub') {
    return createLocalStub();
  }
  if (provider === 'anthropic') {
    const apiKey = overrides.apiKey ?? config.ai.anthropicApiKey;
    if (!apiKey) {
      if (config.isProduction) {
        // Production misconfiguration must fail fast at boot.
        throw new AiProviderError(
          'LLM provider is not configured: set ANTHROPIC_API_KEY or switch LLM_PROVIDER=stub',
        );
      }
      logger.warn(
        'LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty; using the deterministic stub LLM. Set ANTHROPIC_API_KEY or LLM_PROVIDER=stub to silence this warning.',
      );
      return createLocalStub();
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