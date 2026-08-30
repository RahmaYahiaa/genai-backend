import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Assigns a correlation id to every request (trusting only well-formed client
 * values) and echoes it back so clients can reference it in support requests.
 */
export function requestContext(req, res, next) {
  const headerValue = req.headers[REQUEST_ID_HEADER];
  req.id =
    typeof headerValue === 'string' && REQUEST_ID_PATTERN.test(headerValue)
      ? headerValue
      : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
