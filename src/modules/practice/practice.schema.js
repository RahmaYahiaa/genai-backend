import { z } from 'zod';
import { QUESTION_DIFFICULTIES } from '../../config/constants.js';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

export const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const practiceSessionIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  practiceSessionId: objectIdField('practiceSessionId'),
});

export const createPracticeSessionSchema = z.object({
  topicId: objectIdField('topicId'),
  questionsCount: z.coerce.number().int().min(1).max(5).default(3),
});

export const submitPracticeAnswerSchema = z.object({
  questionId: objectIdField('questionId'),
  content: z.string().trim().min(1, 'answer content is required').max(5000),
});

// --- Mandatory Zod contract for the practice LLM output (never trust the model) ---

export const llmPracticeQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
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
    .max(10),
});