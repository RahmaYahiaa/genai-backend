import { z } from 'zod';
import { TUTOR_MODES } from '../../config/constants.js';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

export const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const tutorSessionIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  tutorSessionId: objectIdField('tutorSessionId'),
});

export const createTutorSessionSchema = z.object({
  topicId: objectIdField('topicId'),
  mode: z
    .enum([
      TUTOR_MODES.EXPLANATION,
      TUTOR_MODES.WORKED_EXAMPLE,
      TUTOR_MODES.SUMMARY,
      TUTOR_MODES.REVISION,
      TUTOR_MODES.CODING_HELP,
      TUTOR_MODES.GUIDED_QUESTIONING,
      TUTOR_MODES.PRACTICE,
    ])
    .default(TUTOR_MODES.EXPLANATION),
});

export const sendTutorMessageSchema = z.object({
  content: z.string().trim().min(3, 'question content is required').max(4000),
});

// --- Mandatory Zod contract for the tutor LLM output (never trust the model) ---

export const llmTutorAnswerSchema = z.object({
  answer: z.string().min(3).max(4000),
  usedChunkIds: z.array(z.string().min(1)).max(10).default([]),
});