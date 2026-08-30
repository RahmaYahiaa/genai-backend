import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { config } from '../../../config/index.js';
import { ERROR_CODES } from '../../../config/constants.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/app-error.js';

function zodIssuesToDetails(zodError) {
  return zodError.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Translates any thrown value into the canonical error envelope:
 * { success: false, error: { code, message, details?, requestId } }
 */
function normalizeError(error) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'The request payload is invalid',
      details: zodIssuesToDetails(error),
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      code: ERROR_CODES.INVALID_IDENTIFIER,
      message: `Invalid identifier format for "${error.path}"`,
    };
  }

  // body-parser failures (malformed JSON, oversized payload) are client errors.
  if (error?.type === 'entity.parse.failed') {
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Malformed JSON in request body',
    };
  }

  if (error?.type === 'entity.too.large') {
    return {
      statusCode: 413,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Request body exceeds the allowed size limit',
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'The document failed database validation',
      details: Object.values(error.errors).map((subError) => ({
        path: subError.path,
        message: subError.message,
      })),
    };
  }

  if (error?.code === 11000) {
    const fields = Object.keys(error.keyValue ?? {});
    return {
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
      message: `A resource with the same ${fields.join(', ') || 'unique field'} already exists`,
      details: fields.length > 0 ? { fields } : undefined,
    };
  }

  return {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: config.isProduction
      ? 'Internal server error'
      : error?.message || 'Internal server error',
  };
}

export function errorHandler(error, req, res, _next) {
  const normalized = normalizeError(error);
  const logPayload = {
    requestId: req.id,
    path: req.originalUrl,
    errorName: error?.name,
    errorMessage: error?.message,
  };

  if (normalized.statusCode >= 500) {
    logger.error({ ...logPayload, stack: error?.stack }, 'Unhandled request error');
  } else {
    logger.warn(logPayload, 'Request failed');
  }

  const body = {
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details !== undefined ? { details: normalized.details } : {}),
      requestId: req.id,
    },
  };

  if (!config.isProduction) {
    body.error.stack = error?.stack;
  }

  res.status(normalized.statusCode).json(body);
}
