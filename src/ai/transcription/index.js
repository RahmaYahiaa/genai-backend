/**
 * Transcription provider factory (Strategy pattern). Interface:
 * `transcribe({ audioBase64, mimeType, fileName }) -> { text, model }`.
 * Real ASR only (Groq Whisper) - no stubs.
 */

import { AiProviderError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import { createGroqTranscriptionProvider } from './groq-transcription.provider.js';

export function createTranscriptionProvider(overrides = {}) {
  const provider = overrides.provider ?? config.ai.transcriptionProvider;

  if (provider === 'groq') {
    const apiKey = overrides.apiKey ?? config.ai.groqApiKey;
    if (!apiKey) {
      throw new AiProviderError(
        'Transcription provider is not configured: set GROQ_API_KEY in your .env',
      );
    }
    return createGroqTranscriptionProvider({ apiKey, model: config.ai.groqTranscriptionModel });
  }
  throw new AiProviderError(`Unknown transcription provider "${provider}"`);
}

// Default singleton used by module composition roots (manual DI). The voice
// tutor is hidden in LeRna-bridge mode (LeRna voice is preview-only), so the
// legacy Groq transcription provider is suspended unless a real key exists.
export const transcriptionProvider =
  config.lerna.enabled && !config.ai.groqApiKey ? null : createTranscriptionProvider();