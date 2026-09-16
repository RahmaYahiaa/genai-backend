import { z } from 'zod';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';
import {
  REMEDIAL_ORIGINS,
  REMEDIAL_CONTENT_TYPES,
  REMEDIAL_STATUSES,
  REMEDIAL_AUDIENCE_TYPES,
} from '../../config/constants.js';

export const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const remedialIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  remedialId: objectIdField('remedialId'),
});

export const listRemedialQuerySchema = z.object({
  status: z.enum(Object.values(REMEDIAL_STATUSES)).optional(),
});

export const generateRemedialSchema = z.discriminatedUnion('origin', [
  z.object({
    origin: z.literal(REMEDIAL_ORIGINS.FROM_MISCONCEPTION),
    assignmentId: objectIdField('assignmentId'),
    misconceptionCode: z.string().trim().min(1).max(80),
    contentType: z.enum(Object.values(REMEDIAL_CONTENT_TYPES)),
  }),
  z.object({
    origin: z.literal(REMEDIAL_ORIGINS.STANDALONE),
    topicId: objectIdField('topicId'),
    contentType: z.enum(Object.values(REMEDIAL_CONTENT_TYPES)),
    instructions: z.string().trim().min(1).max(500).optional(),
  }),
]);

export const updateDraftSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    body: z.string().trim().min(20).max(20000).optional(),
  })
  .refine((data) => data.title !== undefined || data.body !== undefined, {
    message: 'At least one of title or body is required',
  });

export const publishRemedialSchema = z
  .object({
    audienceType: z.enum(Object.values(REMEDIAL_AUDIENCE_TYPES)),
    studentIds: z.array(objectIdField('studentIds')).max(500).optional(),
  })
  .refine(
    (data) =>
      data.audienceType !== REMEDIAL_AUDIENCE_TYPES.SELECTED_STUDENTS ||
      (Array.isArray(data.studentIds) && data.studentIds.length > 0),
    { message: 'SELECTED_STUDENTS audience requires a non-empty studentIds list' },
  );

export const remedialOutputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(20000),
});