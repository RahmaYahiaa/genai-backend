import { z } from 'zod';
import { COURSE_STAFF_ROLES } from '../../config/constants.js';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

const titleField = z.string().trim().min(2, 'title is required').max(200);

const learningObjectiveSchema = z.object({
  code: z.string().trim().min(1).max(30).optional(),
  description: z.string().trim().min(1, 'objective description is required').max(500),
});

const createCourseSchema = z.object({
  title: titleField,
  code: z.string().trim().min(1).max(30).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  departmentId: objectIdField('departmentId').optional(),
  semesterId: objectIdField('semesterId').optional(),
});

const updateCourseSchema = z
  .object({
    title: titleField.optional(),
    code: z.string().trim().min(1).max(30).nullable().optional(),
    description: z.string().trim().min(1).max(2000).nullable().optional(),
    departmentId: objectIdField('departmentId').nullable().optional(),
    semesterId: objectIdField('semesterId').nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });

const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

const topicIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  topicId: objectIdField('topicId'),
});

const createTopicSchema = z.object({
  title: titleField,
  description: z.string().trim().min(1).max(1000).optional(),
  order: z.number().int().min(0).optional(),
  learningObjectives: z.array(learningObjectiveSchema).max(20).optional(),
  prerequisiteTopicIds: z.array(objectIdField('prerequisiteTopicIds')).max(20).optional(),
});

const updateTopicSchema = z
  .object({
    title: titleField.optional(),
    description: z.string().trim().min(1).max(1000).nullable().optional(),
    order: z.number().int().min(0).optional(),
    learningObjectives: z.array(learningObjectiveSchema).max(20).optional(),
    prerequisiteTopicIds: z.array(objectIdField('prerequisiteTopicIds')).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });

const addStaffSchema = z.object({
  userId: objectIdField('userId'),
  role: z.enum([COURSE_STAFF_ROLES.INSTRUCTOR, COURSE_STAFF_ROLES.TEACHING_ASSISTANT]).optional(),
});

const userIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  userId: objectIdField('userId'),
});

const studentIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  studentId: objectIdField('studentId'),
});

const enrollSchema = z.object({
  // Required for admins enrolling a student; students enroll themselves.
  studentId: objectIdField('studentId').optional(),
});

const listCoursesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const listEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export {
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
};