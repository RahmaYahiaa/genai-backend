import { Router } from 'express';

export function createAuditRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.get(
    '/courses/:courseId/audit-log',
    validators.courseIdParam,
    validators.listQuery,
    controller.listCourseAudit,
  );

  return router;
}