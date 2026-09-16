import { Router } from 'express';

export function createReviewRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.get(
    '/assignments/:assignmentId/review',
    validators.assignmentIdParam,
    validators.reviewQuery,
    controller.getReview,
  );

  router.get(
    '/assignments/:assignmentId/common-mistakes',
    validators.assignmentIdParam,
    controller.getCommonMistakes,
  );

  router.post(
    '/assignments/:assignmentId/bulk-approve',
    validators.assignmentIdParam,
    validators.bulkApprove,
    controller.bulkApprove,
  );

  router.post(
    '/submissions/:submissionId/approve',
    validators.submissionIdParam,
    controller.approveSubmission,
  );

  router.post(
    '/submissions/:submissionId/edit',
    validators.submissionIdParam,
    validators.decisionScore,
    controller.editSubmission,
  );

  router.post(
    '/submissions/:submissionId/reject',
    validators.submissionIdParam,
    validators.decisionScore,
    controller.rejectSubmission,
  );

  router.post(
    '/submissions/:submissionId/request-resubmission',
    validators.submissionIdParam,
    validators.requestResubmission,
    controller.requestResubmission,
  );

  return router;
}