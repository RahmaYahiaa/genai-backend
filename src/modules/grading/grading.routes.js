import { Router } from 'express';

export function createGradingRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/assignments/:assignmentId/questions/:questionId/preview-evaluation',
    validators.previewQuestionParam,
    validators.previewEvaluation,
    controller.previewEvaluation,
  );

  router.get('/submissions/:submissionId', validators.submissionIdParam, controller.getSubmissionDetail);

  return router;
}