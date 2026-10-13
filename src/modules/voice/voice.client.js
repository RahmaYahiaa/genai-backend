import { AiServiceUnavailableError, NotFoundError } from '../../shared/errors/index.js';

/**
 * Thin HTTP client for the LernaVoice service. Server-side only: the service
 * key is attached here and never reaches the browser. Every call has a hard
 * timeout, and any transport or HTTP failure becomes a 503 for our API.
 */
export function createVoiceClient({ baseUrl, apiKey = '', timeoutMs = 15000, fetchImpl = fetch }) {
  async function request(method, path, body) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (apiKey) headers['X-Voice-Service-Key'] = apiKey;

    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AiServiceUnavailableError('The voice service is unreachable', { reason: error?.name ?? 'network' });
    }

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (response.status === 404 && path.startsWith('/voice/session/')) {
      throw new NotFoundError('Voice session not found');
    }
    if (!response.ok) {
      throw new AiServiceUnavailableError('The voice service returned an error', { status: response.status });
    }
    return data;
  }

  return {
    health: () => request('GET', '/health'),
    createSession: (payload) => request('POST', '/voice/session', payload),
    mintToken: (sessionId) => request('POST', `/voice/session/${encodeURIComponent(sessionId)}/token`),
    latest: (studentId) => request('GET', `/voice/students/${encodeURIComponent(studentId)}/latest`),
  };
}
