import { Router } from 'express';

// Route definitions only. Access control lives in the service: any course
// member (enrolled student or course staff) can generate; artifacts are
// downloadable by their owner only.
export function createLearningResourcesRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/courses/:courseId/learning-resources',
    validators.courseIdParam,
    validators.generate,
    controller.generate,
  );

  router.get(
    '/courses/:courseId/learning-resources',
    validators.courseIdParam,
    validators.listQuery,
    controller.list,
  );

  router.get(
    '/learning-resources/:resourceId/file',
    validators.resourceIdParam,
    controller.download,
  );

  return router;
}
