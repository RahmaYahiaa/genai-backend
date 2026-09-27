import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in `auth.docs.js`
// (kept separate so routing logic and API docs evolve independently).
export function createAuthRouter({ controller, middlewares, validators, rateLimiters }) {
  const router = Router();

  router.post('/register', rateLimiters.authSensitive, validators.register, controller.register);
  router.post('/login', rateLimiters.authSensitive, validators.login, controller.login);
  router.post('/refresh', rateLimiters.authSensitive, validators.refresh, controller.refresh);
  router.get(
    '/registration-guidance',
    rateLimiters.authSensitive,
    validators.registrationGuidance,
    controller.registrationGuidance,
  );
  // Email ownership + password recovery (6-digit codes sent by email).
  router.post('/verify-email', middlewares.authenticate, validators.verifyEmail, controller.verifyEmail);
  router.post('/verify-email/resend', middlewares.authenticate, controller.resendVerification);
  router.post('/forgot-password', validators.forgotPassword, controller.forgotPassword);
  router.post('/reset-password', validators.resetPassword, controller.resetPassword);
  router.post('/logout', middlewares.authenticate, controller.logout);
  router.get('/me', middlewares.authenticate, controller.getProfile);
  router.patch('/me', middlewares.authenticate, validators.updateProfile, controller.updateProfile);

  return router;
}