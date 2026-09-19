import { z } from 'zod';
import { ROLES } from '../../config/constants.js';
import { OFFICER_PERMISSION_KEY_VALUES, OFFICER_TEMPLATES } from './admin.constants.js';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const userIdParamSchema = z.object({
  userId: z.string().regex(OBJECT_ID_PATTERN, 'A valid user id is required'),
});

const setActiveSchema = z.object({
  isActive: z.boolean(),
});

const changeRoleSchema = z.object({
  role: z.enum([ROLES.STUDENT, ROLES.INSTRUCTOR, ROLES.INSTITUTION_ADMIN]),
});

const academicNumberSchema = z.object({
  academicNumber: z.string().trim().max(40).nullable(),
});

const createOfficerSchema = z.object({
  firstName: z.string().trim().min(1, 'firstName is required').max(100),
  lastName: z.string().trim().min(1, 'lastName is required').max(100),
  email: z.email({ error: 'A valid email address is required' }).max(254),
  templateId: z.enum([...OFFICER_TEMPLATES.map((t) => t.id), 'custom']).optional(),
  keys: z.array(z.enum(OFFICER_PERMISSION_KEY_VALUES)).optional(),
});

const templateSchema = z.object({
  templateId: z.enum(OFFICER_TEMPLATES.map((t) => t.id)),
});

const scopesSchema = z.object({
  keys: z.array(z.enum(OFFICER_PERMISSION_KEY_VALUES)),
});

export const adminSchemas = {
  userIdParam: userIdParamSchema,
  setActive: setActiveSchema,
  changeRole: changeRoleSchema,
  academicNumber: academicNumberSchema,
  createOfficer: createOfficerSchema,
  template: templateSchema,
  scopes: scopesSchema,
};
