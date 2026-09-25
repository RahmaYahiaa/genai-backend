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

export const submitAnswerSchema = z
  .object({
    questionId: objectIdField('questionId'),
    // 'idk' = explicit "I don't know / skip" (EDUNation parity): recorded as
    // missing-knowledge evidence, never as a misconception, no LLM call.
    responseMode: z.enum(['text', 'voice', 'idk']).default('text'),
    content: z.string().trim().max(5000).default(''),
    // Required for voice answers (base64 audio payload).
    audioBase64: z.string().min(1).max(2000000).optional(),
    audioMimeType: z.string().trim().max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.responseMode === 'idk') return;
    if (value.responseMode === 'voice') {
      // Voice answers are validated by their audio payload, not by text
      // content — the transcription provider supplies the text downstream.
      if (!value.audioBase64) {
        ctx.addIssue({ code: 'custom', path: ['audioBase64'], message: 'audioBase64 is required for voice answers' });
      }
      return;
    }
    if (value.content.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'answer content is required' });
    }
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