import { Router } from 'express';

// Route definitions only, mounted at /api/v1/admin.
export function createAdminRouter({ controller, middlewares, guards }) {
  const router = Router();

  router.get('/me', guards.authenticate, middlewares.requireInstitutionAdmin, controller.getMe);

  return router;
}
