import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in
// `courses.docs.js` (docs separated from routing logic).
//
// Access control model: GET /:courseId enforces read access via the
// loadCourse middleware. Every other route delegates its stricter access
// check (write/admin/self-enroll rules) to the service, because e.g. a
// student enrolling in a course is by definition not enrolled yet.
export function createCoursesRouter({ controller, middlewares, validators, guards }) {
  const router = Router();

  router.use(guards.authenticate);

  router.post(
    '/',
    guards.authorize('institution_admin', 'student'),
    validators.createCourse,
    controller.create,
  );

  router.get('/', validators.listCoursesQuery, controller.list);

  // Static paths first: they must never be shadowed by GET /:courseId.
  router.get(
    '/catalog',
    guards.authorize('student'),
    validators.catalogQuery,
    controller.catalog,
  );

  router.get(
    '/enrollment-requests',
    guards.authorize('institution_admin'),
    validators.listRequestsQuery,
    controller.listEnrollmentRequests,
  );

  router.get(
    '/enrollment-requests/my',
    guards.authorize('student'),
    validators.listRequestsQuery,
    controller.myEnrollmentRequests,
  );

  router.post(
    '/enrollment-requests/:requestId/decision',
    guards.authorize('institution_admin'),
    validators.enrollmentRequestIdParam,
    validators.decideEnrollmentRequest,
    controller.decideEnrollmentRequest,
  );

  router.get('/:courseId', validators.courseIdParam, middlewares.loadCourse, controller.getOne);

  router.patch('/:courseId', validators.courseIdParam, validators.updateCourse, controller.update);

  router.post(
    '/:courseId/topics',
    validators.courseIdParam,
    validators.createTopic,
    controller.addTopic,
  );

  router.patch(
    '/:courseId/topics/:topicId',
    validators.topicIdParam,
    validators.updateTopic,
    controller.updateTopic,
  );

  router.delete('/:courseId/topics/:topicId', validators.topicIdParam, controller.deleteTopic);

  router.post(
    '/:courseId/staff',
    guards.authorize('institution_admin'),
    validators.courseIdParam,
    validators.addStaff,
    controller.addStaff,
  );

  router.delete(
    '/:courseId/staff/:userId',
    guards.authorize('institution_admin'),
    validators.userIdParam,
    controller.removeStaff,
  );

  router.post(
    '/:courseId/enroll',
    guards.authorize('student', 'institution_admin'),
    validators.courseIdParam,
    validators.enroll,
    controller.enroll,
  );

  router.post(
    '/:courseId/enrollment-request',
    guards.authorize('student'),
    validators.courseIdParam,
    validators.requestEnrollment,
    controller.requestEnrollment,
  );

  router.post(
    '/:courseId/catalog-enroll',
    guards.authorize('student'),
    validators.courseIdParam,
    controller.catalogSelfEnroll,
  );

  router.delete(
    '/:courseId/enroll/:studentId',
    guards.authorize('institution_admin'),
    validators.studentIdParam,
    controller.dropEnrollment,
  );

  router.get(
    '/:courseId/enrollments',
    guards.authorize('institution_admin', 'instructor'),
    validators.courseIdParam,
    validators.listEnrollmentsQuery,
    controller.listEnrollments,
  );

  return router;
}