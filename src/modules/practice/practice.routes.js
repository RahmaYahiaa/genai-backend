import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in
// `practice.docs.js` (docs separated from routing logic).
//
// Access control lives in the service: only the student themself (enrolled
// institutional student or personal-space owner) can use their practice
// sessions.
export function createPracticeRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/courses/:courseId/practice/sessions',
    validators.courseIdParam,
    validators.createSession,
    controller.startSession,
  );

  router.get(
    '/courses/:courseId/practice/sessions/:practiceSessionId',
    validators.practiceSessionIdParam,
    controller.getSession,
  );

  router.post(
    '/courses/:courseId/practice/sessions/:practiceSessionId/answers',
    validators.practiceSessionIdParam,
    validators.submitAnswer,
    controller.submitAnswer,
  );

  return router;
}