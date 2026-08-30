import rateLimit from 'express-rate-limit';

import { ERROR_CODES } from '../../config/constants.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import * as authRepository from './auth.repository.js';
import { authenticate, authorize } from './auth.middlewares.js';
import { createAuthController } from './auth.controller.js';
import { createAuthService } from './auth.service.js';
import { createAuthRouter } from './auth.routes.js';
import { registerSchema, loginSchema, refreshSchema, updateProfileSchema } from './auth.schema.js';
import { academicStructureService } from '../academic-structure/index.js';

// Brute-force protection on credential endpoints. Successful requests do not
// count against the budget so legitimate users are never throttled.
const authSensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Too many authentication attempts, please try again later.',
        requestId: req.id,
      },
    });
  },
});

// Composition root (manual DI): repository -> service -> controller -> router.
const authService = createAuthService({
  repository: authRepository,
  institutionService: academicStructureService,
});

const controller = createAuthController({ authService });

export const authRouter = createAuthRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    register: validateSchemas({ body: registerSchema }),
    login: validateSchemas({ body: loginSchema }),
    refresh: validateSchemas({ body: refreshSchema }),
    updateProfile: validateSchemas({ body: updateProfileSchema }),
  },
  rateLimiters: { authSensitive: authSensitiveLimiter },
});

// Public surface of this module, consumed by other modules and app assembly.
export { authenticate, authorize, authService };