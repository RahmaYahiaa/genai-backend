const errorResponse = (description) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
});

export const commonResponses = {
  ValidationError: errorResponse('Request payload failed validation'),
  Unauthorized: errorResponse('Missing or invalid access token'),
  Forbidden: errorResponse('Authenticated but not allowed to access this resource'),
  NotFound: errorResponse('Resource not found, or outside the caller authorized scope'),
  Conflict: errorResponse('Resource conflicts with an existing one'),
  RateLimited: errorResponse('Too many requests, slow down'),
  InternalError: errorResponse('Unexpected server error'),
};
