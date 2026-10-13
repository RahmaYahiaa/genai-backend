import { config } from '../../config/index.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { tutorSessionRepository, tutorSessionModel } from '../tutor/index.js';
import { retrievalService } from '../retrieval/index.js';
import { VoiceSession } from './voice-session.model.js';
import { createVoiceClient } from './voice.client.js';
import { createVoiceService } from './voice.service.js';
import { createVoiceRouter, createVoiceFacadeRouter } from './voice.routes.js';

// Composition root (manual DI) for the LernaVoice bridge. When VOICE_SERVICE_URL
// is unset the routes answer realtimeVoice: false and never fake a session.
const voiceClient = createVoiceClient({
  baseUrl: config.voice.baseUrl,
  apiKey: config.voice.apiKey,
  timeoutMs: config.voice.timeoutMs,
});

export const voiceService = createVoiceService({
  client: voiceClient,
  voiceSessionModel: VoiceSession,
  tutorSessionRepository,
  tutorSessionModel,
  coursesService,
  retrievalService,
  wsBaseUrl: config.voice.wsBaseUrl,
});

export const voiceRouter = createVoiceRouter({ voiceService, authenticate });
export const voiceFacadeRouter = createVoiceFacadeRouter({ voiceService, facadeApiKey: config.voice.facadeApiKey });
export { VoiceSession };
