import { z } from 'zod';
import { MATERIAL_SOURCE_TYPES } from '../../config/constants.js';
import { objectIdField } from '../academic-structure/academic-structure.schema.js';

export const createMaterialSchema = z.object({
  title: z.string().trim().min(2, 'title is required').max(200),
  sourceType: z
    .enum([
      MATERIAL_SOURCE_TYPES.OFFICIAL_SLIDES,
      MATERIAL_SOURCE_TYPES.LECTURE_NOTES,
      MATERIAL_SOURCE_TYPES.TEXTBOOK,
      MATERIAL_SOURCE_TYPES.INSTRUCTOR_NOTES,
      MATERIAL_SOURCE_TYPES.EXTERNAL_REFERENCE,
    ])
    .optional(),
  mimeType: z.enum(['text/plain', 'text/markdown']).optional(),
  fileName: z.string().trim().max(255).optional(),
  // Stage A accepts inline text (typed or read from a .txt/.md file).
  content: z.string().min(20, 'content is too short to ingest').max(200000),
});

export const listMaterialsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const courseIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
});

export const materialIdParamSchema = z.object({
  courseId: objectIdField('courseId'),
  materialId: objectIdField('materialId'),
});

export const listChunksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});