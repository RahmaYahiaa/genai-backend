/**
 * Removes keys that could change how the database reads a request
 * (e.g. {"email": {"$ne": ""}}) or poison JavaScript objects
 * (__proto__, constructor, prototype). Runs on every JSON/form body.
 */
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

function clean(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (key.startsWith('$') || FORBIDDEN.has(key)) continue;
    out[key] = clean(inner, depth + 1);
  }
  return out;
}

export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}
