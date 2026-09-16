import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';
import { AI_CONFIDENCE, AI_CORRECTNESS } from '../../config/constants.js';

const previewEvaluationSchema = z.object({
  trialAnswer: z.string().trim().min(1, 'trialAnswer is required').max(20000),
});

const llmGradingOutputSchema = z.object({
  score: z.coerce.number().min(0).max(1000),
  correctness: z.enum(Object.values(AI_CORRECTNESS)),
  confidence: z.enum([AI_CONFIDENCE.HIGH, AI_CONFIDENCE.MEDIUM, AI_CONFIDENCE.LOW]),
  feedbackText: z.string().trim().min(1).max(8000),
  misconceptions: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(500),
      }),
    )
    .max(20)
    .default([]),
  rubricBreakdown: z.unknown().nullable().optional(),
});

const submissionIdParamSchema = z.object({
  submissionId: objectIdField('submissionId'),
});

const previewQuestionParamSchema = z.object({
  assignmentId: objectIdField('assignmentId'),
  questionId: objectIdField('questionId'),
});

export { previewEvaluationSchema, llmGradingOutputSchema, submissionIdParamSchema, previewQuestionParamSchema };