import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';
import { AUDIT_ACTIONS } from '../../config/constants.js';

export const auditCourseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const auditListQuerySchema = z.object({
  action: z.enum(Object.values(AUDIT_ACTIONS)).optional(),
  assignmentId: objectIdField('assignmentId').optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});