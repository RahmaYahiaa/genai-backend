/**
 * Transcription provider factory (Strategy pattern). Interface:
 * `transcribe({ audioBase64, mimeType, fileName }) -> { text, model }`.
 * Extend the enum in config when a real ASR provider is connected.
 */

import { AiProviderError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import { createStubTranscriptionProvider } from './stub-transcription.provider.js';

export function createTranscriptionProvider(overrides = {}) {
  const provider = overrides.provider ?? config.ai.transcriptionProvider;

  if (provider === 'stub') {
    return createStubTranscriptionProvider({ modelName: 'stub-asr-v1' });
  }
  throw new AiProviderError(`Unknown transcription provider "${provider}"`);
}

// Default singleton used by module composition roots (manual DI).
export const transcriptionProvider = createTranscriptionProvider();