export const schemas = {
  ErrorDetail: {
    type: 'object',
    properties: {
      path: { type: 'string', example: 'body.email' },
      message: { type: 'string', example: 'Invalid email address' },
      code: { type: 'string', example: 'invalid_string' },
    },
  },
  ErrorBody: {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: { type: 'string', example: 'VALIDATION_ERROR' },
      message: { type: 'string', example: 'The request payload is invalid' },
      details: {
        description: 'Structured context, e.g. per-field validation issues.',
        oneOf: [
          { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' } },
          { type: 'object' },
        ],
      },
      requestId: { type: 'string', example: 'b1c0ffee-8f2e-4f6a-9d3e-7a1b2c3d4e5f' },
    },
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: { $ref: '#/components/schemas/ErrorBody' },
    },
  },
  SuccessEnvelope: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { description: 'Endpoint-specific payload' },
      meta: {
        type: 'object',
        description: 'Optional metadata (pagination, totals).',
        properties: {
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              total: { type: 'integer', example: 57 },
              totalPages: { type: 'integer', example: 3 },
              hasNextPage: { type: 'boolean', example: true },
              hasPreviousPage: { type: 'boolean', example: false },
            },
          },
        },
      },
    },
  },
};
