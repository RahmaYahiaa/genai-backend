/**
 * Base application error. Every error intentionally thrown by the application
 * extends this class so the central error handler can distinguish expected,
 * operational failures (bad input, missing resources) from unexpected bugs.
 */
export class AppError extends Error {
  /**
   * @param {object} options
   * @param {number} options.statusCode HTTP status code.
   * @param {string} options.code Stable machine-readable error code (see ERROR_CODES).
   * @param {string} options.message Human-readable message (safe to expose).
   * @param {unknown} [options.details] Structured extra context (e.g. field issues).
   * @param {boolean} [options.isOperational] False only for truly unexpected programmer errors.
   */
  constructor({ statusCode, code, message, details, isOperational = true }) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
