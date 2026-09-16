import { Router } from 'express';

export function createRemedialRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/courses/:courseId/remedial',
    validators.courseIdParam,
    validators.generate,
    controller.generate,
  );

  router.get(
    '/courses/:courseId/remedial',
    validators.courseIdParam,
    validators.listQuery,
    controller.list,
  );

  router.get(
    '/courses/:courseId/remedial/mine',
    validators.courseIdParam,
    controller.listMine,
  );

  router.get(
    '/courses/:courseId/remedial/:remedialId',
    validators.remedialIdParam,
    controller.getOne,
  );

  router.patch(
    '/courses/:courseId/remedial/:remedialId',
    validators.remedialIdParam,
    validators.updateDraft,
    controller.updateDraft,
  );

  router.post(
    '/courses/:courseId/remedial/:remedialId/publish',
    validators.remedialIdParam,
    validators.publish,
    controller.publish,
  );

  return router;
}