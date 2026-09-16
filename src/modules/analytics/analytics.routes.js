import { Router } from 'express';

export function createAnalyticsRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.get(
    '/instructor/home',
    controller.getInstructorHome,
  );

  router.get(
    '/courses/:courseId/analytics',
    validators.courseIdParam,
    controller.getCourseAnalytics,
  );

  router.get(
    '/courses/:courseId/coverage-gaps',
    validators.courseIdParam,
    controller.getCoverageGaps,
  );

  return router;
}