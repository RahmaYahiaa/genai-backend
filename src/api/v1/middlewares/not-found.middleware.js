import { ERROR_CODES } from '../../../config/constants.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
      requestId: req.id,
    },
  });
}
