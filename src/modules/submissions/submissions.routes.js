import { Router } from 'express';

export function createSubmissionsRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.put(
    '/assignments/:assignmentId/answers/:questionId',
    validators.answerParam,
    validators.autosaveAnswer,
    controller.autosaveAnswer,
  );

  router.post(
    '/assignments/:assignmentId/submit',
    validators.assignmentIdParam,
    controller.submit,
  );

  return router;
}