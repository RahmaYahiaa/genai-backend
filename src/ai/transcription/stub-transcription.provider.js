/**
 * Deterministic offline transcription provider (development/test only).
 *
 * Implements the interface `transcribe({ audioBase64, mimeType, fileName })`
 * -> { text, model }. It produces a stable pseudo-transcript without any
 * network call so the voice-answer path is fully exercisable in tests. The
 * real provider (e.g. Whisper or the ML team's ASR API) plugs into the same
 * interface later.
 */

function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createStubTranscriptionProvider({ modelName }) {
  return {
    name: 'stub',
    model: modelName,

    async transcribe({ audioBase64 = '' }) {
      const seed = hashString(String(audioBase64)) % 1000;
      return {
        text:
          `Transcribed voice answer #${seed}: the student explains their reasoning about the ` +
          'question in detail, mentions the main ideas from the course material, and gives an example.',
        model: modelName,
      };
    },
  };
}