import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in
// `tutor.docs.js` (docs separated from routing logic).
//
// Access control lives in the service: only the student themself (enrolled
// institutional student or personal-space owner) can use their tutor sessions.
export function createTutorRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/courses/:courseId/tutor/sessions',
    validators.courseIdParam,
    validators.createSession,
    controller.createSession,
  );

  router.get(
    '/courses/:courseId/tutor/sessions',
    validators.courseIdParam,
    controller.listSessions,
  );

  router.get(
    '/courses/:courseId/tutor/sessions/:tutorSessionId',
    validators.tutorSessionIdParam,
    controller.getSession,
  );

  router.post(
    '/courses/:courseId/tutor/sessions/:tutorSessionId/messages',
    validators.tutorSessionIdParam,
    validators.sendMessage,
    controller.askQuestion,
  );

  return router;
}