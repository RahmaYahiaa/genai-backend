import { AppError } from './app-error.js';
import { ERROR_CODES } from '../../config/constants.js';

export class ValidationError extends AppError {
  constructor(message = 'The request payload is invalid', details) {
    super({ statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR, message, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required') {
    super({ statusCode: 401, code: ERROR_CODES.UNAUTHORIZED, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to access this resource') {
    super({ statusCode: 403, code: ERROR_CODES.FORBIDDEN, message });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details) {
    super({ statusCode: 409, code: ERROR_CODES.CONFLICT, message, details });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'The request could not be processed', details) {
    super({ statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR, message, details });
  }
}

/**
 * Governance error: raised when retrieval does not provide enough trusted
 * course evidence to answer confidently. The system states that evidence is
 * insufficient instead of hallucinating an answer.
 */
export class InsufficientEvidenceError extends AppError {
  constructor(message = 'There is not enough trusted course evidence to answer this request') {
    super({ statusCode: 422, code: ERROR_CODES.INSUFFICIENT_EVIDENCE, message });
  }
}

/**
 * Raised when an external AI provider fails or returns output that cannot be
 * validated. Never leaks provider internals to clients.
 */
export class AiProviderError extends AppError {
  constructor(message = 'The AI service is temporarily unavailable') {
    super({ statusCode: 502, code: ERROR_CODES.AI_PROVIDER_ERROR, message, isOperational: true });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'The service is temporarily unavailable') {
    super({ statusCode: 503, code: ERROR_CODES.INTERNAL_ERROR, message });
  }
}
