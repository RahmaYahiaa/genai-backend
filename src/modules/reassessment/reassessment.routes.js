import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in
// `reassessment.docs.js` (docs separated from routing logic).
//
// Access control lives in the service: only the student themself (enrolled
// institutional student or personal-space owner) can use their reassessment
// sessions and learning-gain report.
export function createReassessmentRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/courses/:courseId/reassessments',
    validators.courseIdParam,
    validators.createSession,
    controller.startSession,
  );

  router.get('/courses/:courseId/reassessments', validators.courseIdParam, controller.listSessions);

  router.get(
    '/courses/:courseId/reassessments/:reassessmentId',
    validators.reassessmentIdParam,
    controller.getSession,
  );

  router.post(
    '/courses/:courseId/reassessments/:reassessmentId/answers',
    validators.reassessmentIdParam,
    validators.submitAnswer,
    controller.submitAnswer,
  );

  router.get(
    '/courses/:courseId/learning-gain',
    validators.courseIdParam,
    controller.getLearningGain,
  );

  return router;
}