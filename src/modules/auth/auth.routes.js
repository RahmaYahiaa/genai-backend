import { Router } from 'express';
export function createAuthRouter({ controller, middlewares, validators, rateLimiters }) {
  const router = Router();

  router.post('/register', rateLimiters.authSensitive, validators.register, controller.register);
  router.post('/login', rateLimiters.authSensitive, validators.login, controller.login);
  router.post('/refresh', rateLimiters.authSensitive, validators.refresh, controller.refresh);
  router.post('/logout', middlewares.authenticate, controller.logout);
  router.get('/me', middlewares.authenticate, controller.getProfile);
  router.patch('/me', middlewares.authenticate, validators.updateProfile, controller.updateProfile);

  return router;
}