import { config } from '../../config/index.js';
import { AiServiceUnavailableError } from '../../shared/errors/index.js';

/**
 * LeRna (Academic OS) low-level HTTP client. The existing backend is the ONLY
 * client of the LeRna facade: it forwards identity via the `X-Student-Id`
 * header (never our JWT) and never exposes the internal URL/keys to clients.
 * Every failure maps to AiServiceUnavailableError -> 503 so the frontend can
 * render the honest "AI service unavailable" state.
 */
export function createLernaClient() {
  const baseUrl = config.lerna.apiUrl;

  async function request(method, path, { studentId, body, formData, timeoutMs } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? config.lerna.timeoutMs);
    try {
      const headers = {};
      if (studentId) headers['X-Student-Id'] = studentId;
      const init = { method, headers, signal: controller.signal };
      if (formData) {
        init.body = formData; // multipart: fetch sets the boundary itself
      } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }

      let response;
      try {
        response = await fetch(`${baseUrl}${path}`, init);
      } catch (networkError) {
        if (networkError?.name === 'AbortError') {
          throw new AiServiceUnavailableError('The AI service timed out while processing the request');
        }
        throw new AiServiceUnavailableError(
          'The AI service could not be reached',
          [{ message: networkError?.cause?.message ?? networkError.message }],
        );
      }

      const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
      const payload = isJson ? await response.json().catch(() => null) : null;
      if (!response.ok) {
        const detail = payload?.detail;
        throw new AiServiceUnavailableError(
          `AI service request failed (${response.status})`,
          [{ message: typeof detail === 'string' ? detail : JSON.stringify(detail ?? null) }],
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof AiServiceUnavailableError) throw error;
      if (error?.name === 'AbortError') {
        throw new AiServiceUnavailableError('The AI service timed out while processing the request');
      }
      throw new AiServiceUnavailableError('The AI service request failed', [{ message: error?.message }]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function download(downloadPath, studentId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.lerna.timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${downloadPath}`, {
        headers: studentId ? { 'X-Student-Id': studentId } : {},
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AiServiceUnavailableError(`AI artifact download failed (${response.status})`);
      }
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mime: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    } catch (error) {
      if (error instanceof AiServiceUnavailableError) throw error;
      throw new AiServiceUnavailableError('AI artifact download failed', [{ message: error?.message }]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: (path, opts) => request('GET', path, opts),
    post: (path, opts) => request('POST', path, opts),
    patch: (path, opts) => request('PATCH', path, opts),
    download,
    baseUrl,
  };
}
