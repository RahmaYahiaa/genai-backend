import { z } from 'zod';
import { ROLES, MATERIAL_SOURCE_TYPES } from '../../config/constants.js';
import { OFFICER_PERMISSION_KEY_VALUES, OFFICER_TEMPLATES } from './admin.constants.js';

const MATERIAL_SOURCE_TYPE_VALUES = Object.values(MATERIAL_SOURCE_TYPES);

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const optText = (max) => z.string().trim().max(max).optional();
const profilePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    shortName: optText(60),
    tagline: optText(160),
    about: optText(2000),
    mission: optText(600),
    vision: optText(600),
    foundedYear: z.number().int().min(800).max(2100).nullable().optional(),
    city: optText(100),
    country: optText(100),
    address: optText(240),
    website: z.union([z.literal(''), z.string().trim().url('Enter a full website address, like https://example.edu').max(200)]).optional(),
    contactEmail: z.union([z.literal(''), z.email('Enter a valid email').max(200)]).optional(),
    phone: optText(40),
    faculties: z
      .array(z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(300).optional().default('') }))
      .max(24)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const inviteTokenParamSchema = z.object({
  token: z.string().trim().min(20).max(100).regex(/^[A-Za-z0-9_-]+$/, 'This invitation link is not valid'),
});

const acceptInvitationSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one number'),
  languagePreference: z.enum(['en', 'ar']).optional(),
});

const invitationRecordParamSchema = z.object({
  invitationId: z.string().regex(OBJECT_ID_PATTERN, 'A valid invitation id is required'),
});

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

const importRowSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().max(254).optional(),
  role: z.string().max(30).optional(),
  courseCodes: z.array(z.string().max(30)).max(10).optional(),
  // Accepts 1-4 (number or numeric text); empty means unknown.
  studyYear: z.union([z.number(), z.string().max(4), z.null()]).optional(),
});

const studyYearSchema = z.object({
  studyYear: z.coerce.number().int().min(1).max(4).nullable(),
});

const stageImportSchema = z.object({
  fileName: z.string().trim().min(1, 'fileName is required').max(200),
  rows: z.array(importRowSchema).min(1, 'At least one row is required').max(500),
});

const batchIdParamSchema = z.object({
  batchId: z.string().regex(OBJECT_ID_PATTERN, 'A valid batch id is required'),
});

const invitationsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'revoked']).optional(),
});

const requestsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const requestIdParamSchema = z.object({
  requestId: z.string().regex(OBJECT_ID_PATTERN, 'A valid request id is required'),
});

const decideRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().min(3, 'note must be at least 3 characters').max(500).optional(),
});

const settingsPatchSchema = z.object({
  emailDomains: z
    .array(z.string().trim().max(100).regex(/^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/, 'A valid domain is required'))
    .min(1, 'Provide at least one domain')
    .max(10)
    .optional(),
  allowSelfRegistration: z.boolean().optional(),
  allowDoctorCourseCreation: z.boolean().optional(),
  allowedSupplementalSourceTypes: z.array(z.enum(MATERIAL_SOURCE_TYPE_VALUES)).max(10).optional(),
});

const sendLinkInvitationSchema = z.object({
  userId: z.string().regex(OBJECT_ID_PATTERN, 'A valid user id is required'),
});

const linkInvitationsQuerySchema = z.object({
  status: z.enum(['awaiting-consent', 'linked', 'declined']).optional(),
});

const invitationIdParamSchema = z.object({
  invitationId: z.string().regex(OBJECT_ID_PATTERN, 'A valid invitation id is required'),
});

const linkRespondSchema = z.object({
  decision: z.enum(['accept', 'decline']),
});

const auditQuerySchema = z.object({
  scope: z.enum(OFFICER_PERMISSION_KEY_VALUES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminSchemas = {
  userIdParam: userIdParamSchema,
  setActive: setActiveSchema,
  changeRole: changeRoleSchema,
  academicNumber: academicNumberSchema,
  studyYear: studyYearSchema,
  createOfficer: createOfficerSchema,
  template: templateSchema,
  scopes: scopesSchema,
  stageImport: stageImportSchema,
  batchIdParam: batchIdParamSchema,
  invitationsQuery: invitationsQuerySchema,
  requestsQuery: requestsQuerySchema,
  requestIdParam: requestIdParamSchema,
  decideRequest: decideRequestSchema,
  settingsPatch: settingsPatchSchema,
  inviteTokenParam: inviteTokenParamSchema,
  profilePatch: profilePatchSchema,
  acceptInvitation: acceptInvitationSchema,
  invitationRecordParam: invitationRecordParamSchema,
  sendLinkInvitation: sendLinkInvitationSchema,
  linkInvitationsQuery: linkInvitationsQuerySchema,
  invitationIdParam: invitationIdParamSchema,
  linkRespond: linkRespondSchema,
  auditQuery: auditQuerySchema,
};
