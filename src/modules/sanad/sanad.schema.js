import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

const isoDate = (label) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must look like 2026-10-20`);

export const planIdParamSchema = z.object({ planId: objectIdField('planId') });
export const taskParamSchema = z.object({ planId: objectIdField('planId'), taskId: objectIdField('taskId') });

export const createPlanSchema = z.object({
  courseId: objectIdField('courseId'),
  examDate: isoDate('examDate'),
  dailyMinutes: z.coerce.number().int().min(15).max(240),
  topicIds: z.array(objectIdField('topicId')).max(40).optional(),
  goal: z.string().trim().max(500).optional(),
  today: isoDate('today').optional(),
  language: z.string().min(2).max(5).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const listPlansQuerySchema = z.object({
  courseId: objectIdField('courseId').optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

export const completeTaskSchema = z.object({
  feeling: z.enum(['clear', 'confused']).optional(),
  today: isoDate('today').optional(),
});

export const reminderSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 21:30').optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one setting' });

export const unsubscribeSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{24}\.[a-f0-9]{32}$/i, 'This link is not valid'),
});

export const replanSchema = z.object({ today: isoDate('today').optional() });

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'Write a message').max(1000),
  history: z.array(z.object({ role: z.enum(['student', 'sanad']), text: z.string().max(2000) })).max(12).optional(),
  courseId: objectIdField('courseId').optional(),
  today: isoDate('today').optional(),
  language: z.string().min(2).max(5).optional(),
});
