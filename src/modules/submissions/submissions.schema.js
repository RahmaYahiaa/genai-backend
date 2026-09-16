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
    selectedOptionIds: z.array(z.string().trim().min(1)).max(8).optional(),
  })
  .refine(
    (data) =>
      data.answerText !== undefined ||
      data.imageUrl !== undefined ||
      data.selectedOptionIds !== undefined,
    { error: 'Provide answerText, imageUrl or selectedOptionIds' },
  );

export { assignmentIdParamSchema, answerParamSchema, autosaveAnswerSchema };
