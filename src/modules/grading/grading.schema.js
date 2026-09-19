import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';
import { AI_CONFIDENCE, AI_CORRECTNESS } from '../../config/constants.js';

const previewEvaluationSchema = z.object({
  trialAnswer: z.string().trim().min(1, 'trialAnswer is required').max(20000),
});

// Real models answer with varying casing/whitespace; normalize before the
// strict enum so validation rejects wrong values, not formatting.
const upperEnum = (values) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
    z.enum(values),
  );

const llmGradingOutputSchema = z.object({
  score: z.coerce.number().min(0).max(1000),
  correctness: upperEnum(Object.values(AI_CORRECTNESS)),
  confidence: upperEnum([AI_CONFIDENCE.HIGH, AI_CONFIDENCE.MEDIUM, AI_CONFIDENCE.LOW]),
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