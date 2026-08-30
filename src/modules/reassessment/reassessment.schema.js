import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

export const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const reassessmentIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  reassessmentId: objectIdField('reassessmentId'),
});

export const createReassessmentSchema = z.object({
  topicId: objectIdField('topicId'),
  questionsCount: z.coerce.number().int().min(1).max(5).default(2),
});

export const submitReassessmentAnswerSchema = z.object({
  questionId: objectIdField('questionId'),
  content: z.string().trim().min(1, 'answer content is required').max(5000),
});

// The LLM output contracts are the platform-wide ones and are imported where
// used: llmPracticeQuestionsSchema (question shape) and
// llmAnswerEvaluationSchema (grading shape) - no duplicated Zod contracts.