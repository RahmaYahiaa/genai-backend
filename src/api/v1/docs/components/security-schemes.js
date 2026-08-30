export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'JWT access token issued by the auth endpoints. Send as: `Authorization: Bearer <token>`.',
  },
};
