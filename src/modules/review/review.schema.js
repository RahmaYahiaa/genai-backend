import { z } from 'zod';
import { AI_CONFIDENCE } from '../../config/constants.js';
import { assignmentIdParamSchema } from '../assignments/assignments.schema.js';

export { assignmentIdParamSchema };

export const submissionIdParamSchema = z.object({
  submissionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid submissionId'),
});

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export const reviewQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  studentName: z.string().trim().min(1).max(200).optional(),
  confidence: z.enum(Object.keys(AI_CONFIDENCE)).optional(),
  approved: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const bulkApproveSchema = z.object({
  submissionIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid submissionId'))
    .min(1)
    .max(200),
});

export const decisionScoreSchema = z.object({
  score: z.coerce.number().min(0).max(100000),
  feedback: z.string().trim().min(1).max(4000).optional(),
});

export const requestResubmissionSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});