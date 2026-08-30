import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in
// `learner-diagnostic.docs.js` (docs separated from routing logic).
//
// Access control lives in the service: only the student themself (enrolled
// institutional student or personal-space owner) can enter the learning flow.
export function createLearnerDiagnosticRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.get(
    '/courses/:courseId/learner-profile',
    validators.courseIdParam,
    controller.getLearnerProfile,
  );

  router.get(
    '/courses/:courseId/learner-model',
    validators.courseIdParam,
    controller.getLearnerModel,
  );

  router.post(
    '/courses/:courseId/diagnostics',
    validators.courseIdParam,
    validators.startDiagnostic,
    controller.startDiagnostic,
  );

  router.get(
    '/courses/:courseId/diagnostics/:diagnosticId',
    validators.diagnosticIdParam,
    controller.getDiagnostic,
  );

  router.post(
    '/courses/:courseId/diagnostics/:diagnosticId/answers',
    validators.diagnosticIdParam,
    validators.submitAnswer,
    controller.submitAnswer,
  );

  router.get(
    '/courses/:courseId/diagnostics/:diagnosticId/evidence',
    validators.diagnosticIdParam,
    controller.listEvidence,
  );

  return router;
}