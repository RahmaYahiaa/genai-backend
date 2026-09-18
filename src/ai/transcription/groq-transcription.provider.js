import { AiProviderError } from '../../shared/errors/index.js';

const GROQ_ASR_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export function createGroqTranscriptionProvider({ apiKey, model }) {
  if (!apiKey) {
    throw new AiProviderError(
      'Transcription provider is not configured: set GROQ_API_KEY in your .env',
    );
  }

  return {
    name: 'groq',
    model,

    async transcribe({ audioBase64 = '', mimeType = 'audio/webm', fileName = 'audio.webm' }) {
      const buffer = Buffer.from(String(audioBase64), 'base64');
      if (buffer.length === 0) {
        throw new AiProviderError('Transcription request contained no audio data');
      }
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: mimeType }), fileName);
      form.append('model', model);
      form.append('response_format', 'json');
      let response;
      try {
        response = await fetch(GROQ_ASR_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}` },
          body: form,
        });
      } catch {
        throw new AiProviderError('Transcription provider request failed');
      }
      if (!response.ok) {
        throw new AiProviderError(`Transcription provider returned status ${response.status}`);
      }
      const data = await response.json();
      const text = String(data.text ?? '').trim();
      if (!text) {
        throw new AiProviderError('Transcription provider returned an empty transcript');
      }
      return { text, model };
    },
  };
}