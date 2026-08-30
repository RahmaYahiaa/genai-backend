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