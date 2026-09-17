import { Router } from 'express';

export function createAssignmentsRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/courses/:courseId/assignments',
    validators.courseIdParam,
    validators.createAssignment,
    controller.createAssignment,
  );

  router.get(
    '/courses/:courseId/assignments',
    validators.courseIdParam,
    validators.listAssignmentsQuery,
    controller.listAssignments,
  );

  router.get('/assignments/:assignmentId', validators.assignmentIdParam, controller.getAssignment);

  router.patch(
    '/assignments/:assignmentId',
    validators.assignmentIdParam,
    validators.updateAssignment,
    controller.updateAssignment,
  );

  router.post(
    '/assignments/:assignmentId/questions',
    validators.assignmentIdParam,
    validators.createQuestion,
    controller.addQuestion,
  );

  router.patch(
    '/assignments/:assignmentId/questions/:questionId',
    validators.questionIdParam,
    validators.updateQuestion,
    controller.updateQuestion,
  );

  router.delete(
    '/assignments/:assignmentId/questions/:questionId',
    validators.questionIdParam,
    controller.deleteQuestion,
  );

  router.post('/assignments/:assignmentId/publish', validators.assignmentIdParam, controller.publish);

  router.post('/assignments/:assignmentId/close', validators.assignmentIdParam, controller.close);

  router.post('/assignments/:assignmentId/open', validators.assignmentIdParam, controller.reopen);

  router.patch(
    '/assignments/:assignmentId/grade-visibility',
    validators.assignmentIdParam,
    validators.gradeVisibility,
    controller.setGradeVisibility,
  );

  router.patch(
    '/assignments/:assignmentId/feedback-visibility',
    validators.assignmentIdParam,
    validators.feedbackVisibility,
    controller.setFeedbackVisibility,
  );

  return router;
}