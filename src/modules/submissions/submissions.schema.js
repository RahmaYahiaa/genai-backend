import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';
import { assignmentIdParamSchema } from '../assignments/assignments.schema.js';

const answerParamSchema = z.object({
  assignmentId: objectIdField('assignmentId'),
  questionId: objectIdField('questionId'),
});

const autosaveAnswerSchema = z
  .object({
    answerText: z.string().max(20000).nullable().optional(),
    imageUrl: z.string().url('imageUrl must be a valid URL').max(2048).nullable().optional(),
  })
  .refine((data) => data.answerText !== undefined || data.imageUrl !== undefined, {
    error: 'Provide answerText or imageUrl',
  });

export { assignmentIdParamSchema, answerParamSchema, autosaveAnswerSchema };