import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

export const analyticsCourseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});