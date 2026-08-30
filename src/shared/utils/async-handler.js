/**
 * Wraps async route handlers so any rejection is forwarded to the central
 * error middleware instead of crashing the process or hanging the request.
 */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
