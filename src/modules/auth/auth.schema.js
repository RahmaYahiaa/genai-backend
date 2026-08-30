import { z } from 'zod';
import { ROLES, LANGUAGES } from '../../config/constants.js';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const emailField = z.email({ error: 'A valid email address is required' }).max(254);

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

const nameField = (label) =>
  z.string().trim().min(1, `${label} is required`).max(100, `${label} is too long`);

export const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
    firstName: nameField('firstName'),
    lastName: nameField('lastName'),
    role: z.enum([ROLES.STUDENT, ROLES.INSTRUCTOR, ROLES.INSTITUTION_ADMIN]),
    institutionId: z
      .string()
      .regex(OBJECT_ID_PATTERN, 'institutionId must be a 24-character hex id')
      .optional(),
    institutionName: z.string().trim().min(2).max(200).optional(),
    languagePreference: z.enum([LANGUAGES.ENGLISH, LANGUAGES.ARABIC]).default(LANGUAGES.ENGLISH),
  })
  .superRefine((data, ctx) => {
    if (data.role === ROLES.INSTITUTION_ADMIN && !data.institutionName) {
      ctx.addIssue({
        code: 'custom',
        path: ['institutionName'],
        message: 'institutionName is required when registering an institution admin',
      });
    }
    if (data.role !== ROLES.INSTITUTION_ADMIN && !data.institutionId) {
      ctx.addIssue({
        code: 'custom',
        path: ['institutionId'],
        message: 'institutionId is required for students and instructors',
      });
    }
  });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required').max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'refreshToken is required'),
});

export const updateProfileSchema = z
  .object({
    firstName: nameField('firstName').optional(),
    lastName: nameField('lastName').optional(),
    languagePreference: z.enum([LANGUAGES.ENGLISH, LANGUAGES.ARABIC]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Provide at least one field to update',
  });