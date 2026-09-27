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
  topicId: objectIdField('topicId').optional(),
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

export const renameTutorSessionSchema = z.object({
  title: z.string().trim().max(120).nullable(),
});

export const sendTutorMessageSchema = z.object({
  content: z.string().trim().min(3, 'question content is required').max(4000),
  // Optional material scoping (EDUNation "Use materials" parity): when set,
  // retrieval runs ONLY inside these materials and no external discovery is
  // attempted — an explicit student choice to constrain the source.
  materialIds: z.array(objectIdField('materialIds[]')).max(10).optional(),
});

// --- Mandatory Zod contract for the tutor LLM output (never trust the model) ---

export const llmTutorAnswerSchema = z.object({
  answer: z.string().min(3).max(4000),
  usedChunkIds: z.array(z.string().min(1)).max(10).default([]),
});

// LLM output for the trusted-external path: cites sources by their 1-based
// index in the provided source list (enforced structurally, like chunk ids).
export const llmExternalAnswerSchema = z.object({
  answer: z.string().min(3).max(4000),
  usedSourceIndexes: z.array(z.coerce.number().int().min(1)).max(6).default([]),
});