import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { AiProviderError } from '../../shared/errors/index.js';

const API_PREFIX = '/api/v1/assess';
const TOKEN_REFRESH_MS = 60 * 60 * 1000;
const tokenCache = new Map();

// Bridge-user passwords are derived from our JWT secret. The username carries
// a fingerprint of that secret so rotating the secret simply registers fresh
// bridge users instead of failing login against the old ones.
const SECRET_FINGERPRINT = crypto
  .createHmac('sha256', config.jwt.accessSecret)
  .update('genai-engine-bridge-fingerprint')
  .digest('hex')
  .slice(0, 8);
const INSTRUCTOR_USERNAME = `genai-engine-instr-${SECRET_FINGERPRINT}`;

function bridgePassword(username) {
  return crypto
    .createHmac('sha256', config.jwt.accessSecret)
    .update(`genai-engine-bridge:${username}`)
    .digest('hex');
}

async function request(path, { method = 'GET', token = null, body = null, form = null, timeoutMs = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    let payload;
    if (form) {
      payload = form;
    } else if (body !== null) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(`${config.assessmentEngine.apiUrl}${API_PREFIX}${path}`, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const error = new AiProviderError(
        data?.error?.message ?? `Assessment engine returned status ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError(
      `Assessment engine unreachable at ${config.assessmentEngine.apiUrl}: ${error?.message ?? 'network error'}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function getToken(username, role) {
  const cached = tokenCache.get(username);
  if (cached && Date.now() < cached.refreshAt) return cached.token;
  const password = bridgePassword(username);
  let data;
  try {
    data = await request('/auth/register', {
      method: 'POST',
      body: { username, password, role, display_name: username },
    });
  } catch {
    // Already registered (or any register-side rejection): fall back to login.
    data = await request('/auth/login', { method: 'POST', body: { username, password } });
  }
  tokenCache.set(username, { token: data.token, refreshAt: Date.now() + TOKEN_REFRESH_MS });
  return data.token;
}

export const engineClient = {
  async createCourse({ title, subject, code, description }) {
    const token = await getToken(INSTRUCTOR_USERNAME, 'instructor');
    return request('/courses', { method: 'POST', token, body: { title, subject, code, description } });
  },

  async uploadMaterial(engineCourseId, filename, buffer, mimeType) {
    const token = await getToken(INSTRUCTOR_USERNAME, 'instructor');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType ?? 'application/octet-stream' }), filename);
    return request(`/courses/${engineCourseId}/materials`, { method: 'POST', token, form, timeoutMs: 300000 });
  },

  async createAssessment(engineCourseId, payload) {
    const token = await getToken(INSTRUCTOR_USERNAME, 'instructor');
    return request(`/assessments?course_id=${engineCourseId}`, { method: 'POST', token, body: payload });
  },

  async publishAssessment(engineAssessmentId) {
    const token = await getToken(INSTRUCTOR_USERNAME, 'instructor');
    return request(`/assessments/${engineAssessmentId}/status/published`, { method: 'POST', token });
  },

  async getAssessment(engineAssessmentId) {
    const token = await getToken(INSTRUCTOR_USERNAME, 'instructor');
    return request(`/assessments/${engineAssessmentId}`, { token });
  },

  async submit(engineAssessmentId, studentKey, answers) {
    const token = await getToken(`genai-eng-stu-${SECRET_FINGERPRINT}-${studentKey}`, 'student');
    return request(`/assessments/${engineAssessmentId}/submissions`, {
      method: 'POST',
      token,
      body: { answers },
      timeoutMs: 600000,
    });
  },

  async submissionView(submissionId) {
    const token = await getToken(INSTRUCTOR_USERNAME, 'instructor');
    return request(`/submissions/${submissionId}`, { token, timeoutMs: 120000 });
  },
};