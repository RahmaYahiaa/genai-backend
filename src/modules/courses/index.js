import Course from './course.model.js';
import Enrollment from './enrollment.model.js';
import EnrollmentRequest from './enrollment-request.model.js';
import * as courseRepository from './course.repository.js';
import * as enrollmentRepository from './enrollment.repository.js';
import * as enrollmentRequestRepository from './enrollment-request.repository.js';
import { authenticate, authorize, authService } from '../auth/index.js';
import { academicStructureService } from '../academic-structure/index.js';
import { createCoursesService } from './courses.service.js';
import { createCourseMiddlewares } from './courses.middlewares.js';
import { createCoursesController } from './courses.controller.js';
import { createCoursesRouter } from './courses.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  enrollmentRequestIdParamSchema,
  requestEnrollmentSchema,
  decideEnrollmentRequestSchema,
  catalogQuerySchema,
  listRequestsQuerySchema,
  createCourseSchema,
  updateCourseSchema,
  courseIdParamSchema,
  topicIdParamSchema,
  createTopicSchema,
  updateTopicSchema,
  addStaffSchema,
  userIdParamSchema,
  studentIdParamSchema,
  enrollSchema,
  listCoursesQuerySchema,
  listEnrollmentsQuerySchema,
} from './courses.schema.js';

export { Course as courseModel, Enrollment as enrollmentModel, EnrollmentRequest as enrollmentRequestModel };
export { courseRepository, enrollmentRepository, enrollmentRequestRepository };

// Composition root (manual DI): repositories + cross-module services -> service
// -> middlewares -> controller -> router.
export const coursesService = createCoursesService({
  courseRepository,
  enrollmentRepository,
  enrollmentRequestRepository,
  authService,
  academicStructureService,
});

const middlewares = createCourseMiddlewares({ coursesService });
const controller = createCoursesController({ coursesService });

export const coursesRouter = createCoursesRouter({
  controller,
  middlewares,
  guards: { authenticate, authorize },
  validators: {
    createCourse: validateSchemas({ body: createCourseSchema }),
    updateCourse: validateSchemas({ body: updateCourseSchema }),
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    topicIdParam: validateSchemas({ params: topicIdParamSchema }),
    createTopic: validateSchemas({ body: createTopicSchema }),
    updateTopic: validateSchemas({ body: updateTopicSchema }),
    addStaff: validateSchemas({ body: addStaffSchema }),
    userIdParam: validateSchemas({ params: userIdParamSchema }),
    studentIdParam: validateSchemas({ params: studentIdParamSchema }),
    enroll: validateSchemas({ body: enrollSchema }),
    listCoursesQuery: validateSchemas({ query: listCoursesQuerySchema }),
    listEnrollmentsQuery: validateSchemas({ query: listEnrollmentsQuerySchema }),
    enrollmentRequestIdParam: validateSchemas({ params: enrollmentRequestIdParamSchema }),
    requestEnrollment: validateSchemas({ body: requestEnrollmentSchema }),
    decideEnrollmentRequest: validateSchemas({ body: decideEnrollmentRequestSchema }),
    catalogQuery: validateSchemas({ query: catalogQuerySchema }),
    listRequestsQuery: validateSchemas({ query: listRequestsQuerySchema }),
  },
});