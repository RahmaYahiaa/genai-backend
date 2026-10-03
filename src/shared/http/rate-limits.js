import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

import { ERROR_CODES } from '../../config/constants.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

/**
 * Per-user rate limiting.
 *
 * Every request is counted against the signed-in USER (from the bearer token)
 * so one person cannot exhaust the AI budget for everyone, and students
 * sharing a university network / NAT are not blocked together. Requests
 * without a valid token (login, register, password reset) are counted per IP.
 *
 * Two layers:
 *  1. a general budget for all API traffic (RATE_LIMIT_MAX_REQUESTS per
 *     RATE_LIMIT_WINDOW_MINUTES per user; anonymous: a third of it per IP);
 *  2. per-endpoint budgets (table below), mostly for the AI features, where
 *     each call costs LLM tokens. Several windows can apply to one endpoint
 *     (e.g. a short burst limit and a daily cap).
 *
 * RATE_LIMIT_MULTIPLIER scales every per-endpoint number (e.g. 10 for load
 * tests or seeding); RATE_LIMIT_DISABLED=true turns limiting off (dev only).
 * Counters live in memory unless REDIS_URL is set (then shared via Redis).
 */

// ---- Shared counters (optional) -------------------------------------------
// With REDIS_URL set, every API instance shares the same counters and they
// survive restarts. Without it, counters live in this process's memory.
// If Redis goes down, requests are let through (passOnStoreError) instead of
// failing, and the error is logged once.
let redisClient = null;
if (config.rateLimit.redisUrl) {
  redisClient = createClient({ url: config.rateLimit.redisUrl });
  let warned = false;
  redisClient.on('error', (err) => {
    if (!warned) logger.error({ err: err.message }, '[rate-limit] Redis unavailable - limits are paused until it reconnects');
    warned = true;
  });
  redisClient.on('ready', () => {
    warned = false;
    logger.info('[rate-limit] Using Redis for shared rate-limit counters');
  });
  redisClient.connect().catch(() => {});
}

function storeFor(name) {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix: `rl:${name}:`,
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Reads the user id from the bearer token without hitting the database. */
function userIdFromRequest(req) {
  if (req.user?.id) return req.user.id;
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7).trim(), config.jwt.accessSecret, { algorithms: ['HS256'] });
    return payload?.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

function clientKey(req) {
  const userId = userIdFromRequest(req);
  return userId ? `u:${userId}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

function humanWait(ms) {
  const minutes = Math.ceil(ms / MINUTE);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function makeLimiter({ name, windowMs, limit, message, key = clientKey, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    store: storeFor(`${name}:${windowMs}`),
    passOnStoreError: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator: (req) => `${name}:${key(req)}`,
    // Not our own failures (validation, 5xx from the AI provider): only count
    // requests that reached the endpoint. Keeps retries after errors fair.
    requestWasSuccessful: (_req, res) => res.statusCode < 400,
    handler: (req, res, _next, options) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfterMs = resetTime ? Math.max(0, resetTime.getTime() - Date.now()) : options.windowMs;
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      res.status(429).json({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: `${message ?? 'Too many requests.'} Try again in ${humanWait(retryAfterMs)}.`,
          limit: name,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
          requestId: req.id,
        },
      });
    },
  });
}

const scale = (n) => Math.max(1, Math.round(n * config.rateLimit.multiplier));

/**
 * Per-endpoint budgets. `path` is matched against the URL below /api/v1.
 * Numbers are per user (per IP for the anonymous auth endpoints).
 *
 * Rationale: a very active student in a study session might ask the tutor a
 * question every 20-30 seconds and do several practice rounds per hour; the
 * limits sit well above that, but stop scripts and runaway loops from
 * burning the shared Groq/LeRna budget.
 */
const RULES = [
  // ---- Account (anonymous: per IP) ----
  { name: 'register', method: 'POST', path: /^\/auth\/register$/, windows: [[HOUR, 5]], message: 'Too many sign-up attempts.' },
  { name: 'forgot-password', method: 'POST', path: /^\/auth\/forgot-password$/, windows: [[HOUR, 5]], message: 'Too many password reset requests.' },
  { name: 'reset-password', method: 'POST', path: /^\/auth\/reset-password$/, windows: [[15 * MINUTE, 10]], message: 'Too many reset attempts.' },
  // ---- Account (signed in: per user) ----
  { name: 'verify-email', method: 'POST', path: /^\/auth\/verify-email$/, windows: [[15 * MINUTE, 10]], message: 'Too many code attempts.' },
  { name: 'verify-email-resend', method: 'POST', path: /^\/auth\/verify-email\/resend$/, windows: [[15 * MINUTE, 3], [DAY, 10]], message: 'Too many codes requested.' },
  { name: 'profile-update', method: 'PATCH', path: /^\/auth\/me$/, windows: [[15 * MINUTE, 30]] },

  // ---- AI tutor ----
  { name: 'tutor-message', method: 'POST', path: /^\/courses\/[^/]+\/tutor\/sessions\/[^/]+\/messages$/, windows: [[10 * MINUTE, 30], [DAY, 300]], message: 'You have sent a lot of questions to the tutor.' },
  { name: 'tutor-session', method: 'POST', path: /^\/courses\/[^/]+\/tutor\/sessions$/, windows: [[HOUR, 30]] },

  // ---- Practice / level check / progress check (each start generates questions with AI) ----
  { name: 'practice-start', method: 'POST', path: /^\/courses\/[^/]+\/practice\/sessions$/, windows: [[HOUR, 20], [DAY, 100]], message: 'You have started a lot of practice sessions.' },
  { name: 'practice-answer', method: 'POST', path: /^\/courses\/[^/]+\/practice\/sessions\/[^/]+\/answers$/, windows: [[HOUR, 150]] },
  { name: 'diagnostic-start', method: 'POST', path: /^\/courses\/[^/]+\/diagnostics$/, windows: [[HOUR, 6], [DAY, 20]], message: 'You have started a lot of level checks.' },
  { name: 'diagnostic-answer', method: 'POST', path: /^\/courses\/[^/]+\/diagnostics\/[^/]+\/answers$/, windows: [[HOUR, 200]] },
  { name: 'reassessment-start', method: 'POST', path: /^\/courses\/[^/]+\/reassessments$/, windows: [[HOUR, 15], [DAY, 60]], message: 'You have started a lot of progress checks.' },
  { name: 'reassessment-answer', method: 'POST', path: /^\/courses\/[^/]+\/reassessments\/[^/]+\/answers$/, windows: [[HOUR, 150]] },

  // ---- Study tools / Content Builder (one call can create up to 10 items) ----
  { name: 'sanad-chat', method: 'POST', path: /^\/sanad\/chat$/, windows: [[10 * MINUTE, 40], [DAY, 300]], message: 'You have sent a lot of messages to Sanad.' },
  { name: 'sanad-plan', method: 'POST', path: /^\/sanad\/plans(\/[^/]+\/replan)?$/, windows: [[HOUR, 10], [DAY, 30]], message: 'You have made a lot of study plans.' },
  { name: 'sanad-reminder-test', method: 'POST', path: /^\/sanad\/reminders\/test$/, windows: [[HOUR, 5]], message: 'You have sent a lot of test reminders.' },
  { name: 'sanad-unsubscribe', method: 'POST', path: /^\/sanad\/reminders\/unsubscribe$/, windows: [[HOUR, 30]] },
  { name: 'sanad-task', method: 'POST', path: /^\/sanad\/plans\/[^/]+\/tasks\/[^/]+\/(start|complete)$/, windows: [[HOUR, 60]] },
  { name: 'study-tools', method: 'POST', path: /^\/courses\/[^/]+\/learning-resources$/, windows: [[HOUR, 12], [DAY, 60]], message: 'You have created a lot of study material.' },

  // ---- Files and AI topic detection ----
  { name: 'material-upload', method: 'POST', path: /^\/courses\/[^/]+\/materials(\/file)?$/, windows: [[HOUR, 40], [DAY, 150]], message: 'You have uploaded a lot of files.' },
  { name: 'topics-ai', method: 'POST', path: /^\/courses\/[^/]+\/topics\/(detect|merge)$/, windows: [[HOUR, 20]] },

  // ---- Assignments ----
  { name: 'grading-preview', method: 'POST', path: /^\/assignments\/[^/]+\/questions\/[^/]+\/preview-evaluation$/, windows: [[HOUR, 40]], message: 'You have run a lot of grading previews.' },
  { name: 'assignment-autosave', method: 'PUT', path: /^\/assignments\/[^/]+\/answers\/[^/]+$/, windows: [[15 * MINUTE, 600]] },
  { name: 'assignment-submit', method: 'POST', path: /^\/assignments\/[^/]+\/submit$/, windows: [[HOUR, 20]] },
  { name: 'remedial-ai', method: 'POST', path: /^\/courses\/[^/]+\/remedial$/, windows: [[HOUR, 20]] },

  // ---- Enrollment & admin bulk jobs ----
  { name: 'enrollment-request', method: 'POST', path: /^\/courses\/[^/]+\/(enrollment-request|catalog-enroll)$/, windows: [[HOUR, 20]] },
  { name: 'invite-open', method: 'GET', path: /^\/invitations\/[^/]+$/, windows: [[15 * MINUTE, 30]], message: 'Too many attempts to open invitation links.' },
  { name: 'invite-accept', method: 'POST', path: /^\/invitations\/[^/]+\/accept$/, windows: [[15 * MINUTE, 10]], message: 'Too many attempts to accept an invitation.' },
  { name: 'invite-resend', method: 'POST', path: /^\/admin\/invitations\/[^/]+\/(resend|revoke)$/, windows: [[HOUR, 60]], message: 'You have re-sent a lot of invitations.' },
  { name: 'profile-edit', method: 'PATCH', path: /^\/admin\/profile$/, windows: [[15 * MINUTE, 30]] },
  { name: 'bulk-import', method: 'POST', path: /^\/admin\/imports(\/[^/]+\/confirm)?$/, windows: [[HOUR, 20]] },
];

const compiled = RULES.map((rule) => ({
  ...rule,
  limiters: rule.windows.map(([windowMs, limit], index) =>
    makeLimiter({ name: rule.windows.length > 1 ? `${rule.name}#${index + 1}` : rule.name, windowMs, limit: scale(limit), message: rule.message }),
  ),
}));

/** Applies every matching per-endpoint limiter in sequence. */
export function endpointLimiter(req, res, next) {
  if (config.rateLimit.disabled) return next();
  const path = req.path.replace(/\/+$/, '');
  const matches = compiled.filter((rule) => rule.method === req.method && rule.path.test(path));
  if (matches.length === 0) return next();
  const chain = matches.flatMap((rule) => rule.limiters);
  let index = 0;
  const run = (error) => {
    if (error) return next(error);
    if (res.headersSent) return undefined;
    const limiter = chain[index++];
    if (!limiter) return next();
    return limiter(req, res, run);
  };
  return run();
}

/** General budget for all API traffic: per user, or per IP when anonymous. */
export const generalLimiter = (() => {
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMinutes * MINUTE,
    limit: (req) => (userIdFromRequest(req) ? config.rateLimit.maxRequests : Math.max(60, Math.round(config.rateLimit.maxRequests / 3))),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `general:${clientKey(req)}`,
    store: storeFor('general'),
    passOnStoreError: true,
    skip: (req) => req.path === '/v1/health' || req.path === '/health',
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfterMs = resetTime ? Math.max(0, resetTime.getTime() - Date.now()) : config.rateLimit.windowMinutes * MINUTE;
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      res.status(429).json({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: `Too many requests, please slow down. Try again in ${humanWait(retryAfterMs)}.`,
          limit: 'general',
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
          requestId: req.id,
        },
      });
    },
  });
  return (req, res, next) => (config.rateLimit.disabled ? next() : limiter(req, res, next));
})();

/** Exposed for docs/tests: the effective per-endpoint table. */
export function describeRateLimits() {
  return RULES.map((rule) => ({
    name: rule.name,
    method: rule.method,
    path: rule.path.source,
    windows: rule.windows.map(([windowMs, limit]) => ({ windowMinutes: windowMs / MINUTE, limit: scale(limit) })),
  }));
}
