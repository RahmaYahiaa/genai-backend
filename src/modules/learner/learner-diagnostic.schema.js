import { z } from 'zod';
import { QUESTION_DIFFICULTIES } from '../../config/constants.js';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

export const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const diagnosticIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  diagnosticId: objectIdField('diagnosticId'),
});

export const startDiagnosticSchema = z.object({
  topicIds: z.array(objectIdField('topicIds')).min(1).max(50).optional(),
  questionsPerTopic: z.coerce.number().int().min(1).max(5).default(2),
});

export const submitAnswerSchema = z.object({
  questionId: objectIdField('questionId'),
  responseMode: z.enum(['text', 'voice']).default('text'),
  content: z.string().trim().min(1, 'answer content is required').max(5000),
  // Required for voice answers (base64 audio payload).
  audioBase64: z.string().min(1).max(2000000).optional(),
  audioMimeType: z.string().trim().max(100).optional(),
});

// --- Mandatory Zod contracts for LLM outputs (never trust the model) ---

export const llmGeneratedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        topicId: z.string().min(1),
        objectiveCode: z.string().max(30).nullable().optional(),
        prompt: z.string().min(8).max(1000),
        difficulty: z
          .enum([
            QUESTION_DIFFICULTIES.EASY,
            QUESTION_DIFFICULTIES.MEDIUM,
            QUESTION_DIFFICULTIES.HARD,
          ])
          .default(QUESTION_DIFFICULTIES.MEDIUM),
      }),
    )
    .min(1)
    .max(100),
});

export const llmAnswerEvaluationSchema = z.object({
  correctness: z.enum(['incorrect', 'partial', 'correct']),
  confidence: z.number().min(0).max(1).optional(),
  misconceptions: z
    .array(
      z.object({
        code: z.string().max(60).optional(),
        description: z.string().min(3).max(300),
      }),
    )
    .max(5)
    .optional(),
  feedback: z.string().min(3).max(2000),
});