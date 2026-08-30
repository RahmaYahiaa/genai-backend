import { z } from 'zod';
import { ACADEMIC_UNIT_TYPES, LANGUAGES } from '../../config/constants.js';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const objectIdField = (label) =>
  z.string().regex(OBJECT_ID_PATTERN, `${label} must be a 24-character hex id`);

const nameField = (label) =>
  z.string().trim().min(1, `${label} is required`).max(100, `${label} is too long`);

export const institutionIdParamSchema = z.object({
  institutionId: objectIdField('institutionId'),
});

export const updateInstitutionSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    country: z.string().trim().min(2).max(100).optional(),
    defaultLanguage: z.enum([LANGUAGES.ENGLISH, LANGUAGES.ARABIC]).optional(),
    emailDomains: z
      .array(z.string().trim().min(3).max(253))
      .max(10, 'Provide at most 10 email domains')
      .optional(),
    allowSelfRegistration: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });

export const createUnitSchema = z.object({
  type: z.enum([
    ACADEMIC_UNIT_TYPES.FACULTY,
    ACADEMIC_UNIT_TYPES.DEPARTMENT,
    ACADEMIC_UNIT_TYPES.PROGRAM,
    ACADEMIC_UNIT_TYPES.SEMESTER,
  ]),
  name: z.string().trim().min(2, 'name is required').max(200),
  code: z.string().trim().min(1).max(50).optional(),
  parentId: objectIdField('parentId').optional(),
});

export const listUnitsQuerySchema = z.object({
  type: z
    .enum([
      ACADEMIC_UNIT_TYPES.FACULTY,
      ACADEMIC_UNIT_TYPES.DEPARTMENT,
      ACADEMIC_UNIT_TYPES.PROGRAM,
      ACADEMIC_UNIT_TYPES.SEMESTER,
    ])
    .optional(),
  parentId: objectIdField('parentId').optional(),
});

export const unitIdParamSchema = z.object({
  unitId: objectIdField('unitId'),
});

export const updateUnitSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    code: z.string().trim().min(1).max(50).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });

export { nameField, objectIdField };