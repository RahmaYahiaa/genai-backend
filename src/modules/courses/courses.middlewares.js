import { asyncHandler } from '../../shared/utils/async-handler.js';

/**
 * Route helpers for course-scoped endpoints. `loadCourse` fetches the course
 * once and enforces read access for the caller; write/admin checks are separate
 * so routers can compose them explicitly.
 */
export function createCourseMiddlewares({ coursesService }) {
  const loadCourse = asyncHandler(async (req, _res, next) => {
    const course = await coursesService.getCourse(req.user, req.validated.params.courseId);
    req.course = course;
    next();
  });

  // Note: read access is already enforced by loadCourse; write access must be
  // stricter (admin-of-institution, staff member, or personal owner), which is
  // checked inside the service mutations themselves.

  return { loadCourse };
}