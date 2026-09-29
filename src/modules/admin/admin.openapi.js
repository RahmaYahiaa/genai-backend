/**
 * OpenAPI documentation for the institution admin area (/admin/*), the public
 * emailed invitation links (/invitations/*) and the student side of account
 * linking (/link-invitations/*).
 *
 * Request bodies/queries are generated from adminSchemas (the same zod
 * schemas the routes validate with).
 */
import { adminSchemas as s } from './admin.schema.js';
import { OFFICER_PERMISSION_KEY_VALUES, OFFICER_TEMPLATES } from './admin.constants.js';
import { op, ok, errors, body, pathParams, queryFromZod, bilingual, objectId } from '../../api/v1/docs/openapi-helpers.js';

const ADMIN = 'Institution Admin';
const INVITE = 'Invitations';

const SCOPE_NOTE = (key) =>
  `Institution admins only. Super admin always allowed; an officer needs the \`${key}\` permission.`;
const SUPER_NOTE = 'Super admin only.';
const ANY_ADMIN = 'Any institution admin (super admin or officer).';

const user = {
  type: 'object',
  properties: {
    id: objectId,
    email: { type: 'string', format: 'email' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    role: { type: 'string', enum: ['student', 'instructor', 'institution_admin'] },
    accountType: { type: 'string', enum: ['institutional', 'individual'] },
    institutionId: { ...objectId, nullable: true },
    isActive: { type: 'boolean' },
    isSuperAdmin: { type: 'boolean' },
    academicNumber: { type: 'string', nullable: true },
    studyYear: { type: 'integer', nullable: true, minimum: 1, maximum: 4 },
    emailVerified: { type: 'boolean' },
    lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const permissionKeys = { type: 'array', items: { type: 'string', enum: OFFICER_PERMISSION_KEY_VALUES } };

const importRow = {
  type: 'object',
  properties: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string', enum: ['student', 'instructor'] },
    courseCodes: { type: 'array', items: { type: 'string' } },
    studyYear: { type: 'integer', nullable: true },
    verdict: {
      type: 'string',
      enum: ['new', 'existing', 'error'],
      description: 'new = an invitation email will be sent; existing = already has an account and is enrolled directly; error = row rejected.',
    },
    errorReason: { ...bilingual, nullable: true },
  },
};
const importCounts = {
  type: 'object',
  properties: { new: { type: 'integer' }, existing: { type: 'integer' }, error: { type: 'integer' } },
};

const invitation = {
  type: 'object',
  properties: {
    id: objectId,
    email: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    role: { type: 'string', enum: ['student', 'instructor', 'institution_admin'] },
    status: { type: 'string', enum: ['pending', 'accepted', 'revoked'] },
    sentAt: { type: 'string', format: 'date-time' },
    acceptedAt: { type: 'string', format: 'date-time', nullable: true },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    expired: { type: 'boolean', description: 'Pending but the link is past its expiry date.' },
    emailStatus: {
      type: 'string',
      nullable: true,
      enum: ['sent', 'logged', 'failed', null],
      description: 'sent = delivered to the mail server; logged = SMTP is not configured, the link was written to the server log; failed = sending failed.',
    },
    lastSentAt: { type: 'string', format: 'date-time', nullable: true },
    sendCount: { type: 'integer' },
    waitingDays: { type: 'integer' },
  },
};

const settingsView = {
  type: 'object',
  properties: {
    id: objectId,
    name: { type: 'string' },
    country: { type: 'string', nullable: true },
    emailDomains: { type: 'array', items: { type: 'string' } },
    contractEndsAt: { type: 'string', format: 'date-time', nullable: true },
    settings: {
      type: 'object',
      properties: {
        allowSelfRegistration: { type: 'boolean' },
        allowDoctorCourseCreation: { type: 'boolean' },
        allowedSupplementalSourceTypes: { type: 'array', items: { type: 'string' } },
      },
    },
    materialSourceTypes: { type: 'array', items: { type: 'string' }, description: 'All values accepted by allowedSupplementalSourceTypes.' },
  },
};

const profileView = {
  type: 'object',
  properties: {
    id: objectId,
    name: { type: 'string' },
    country: { type: 'string' },
    emailDomains: { type: 'array', items: { type: 'string' } },
    shortName: { type: 'string' },
    tagline: { type: 'string' },
    about: { type: 'string' },
    mission: { type: 'string' },
    vision: { type: 'string' },
    foundedYear: { type: 'integer', nullable: true },
    city: { type: 'string' },
    address: { type: 'string' },
    website: { type: 'string' },
    contactEmail: { type: 'string' },
    phone: { type: 'string' },
    faculties: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
    },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const linkInvitation = {
  type: 'object',
  properties: {
    id: objectId,
    userId: objectId,
    email: { type: 'string' },
    status: { type: 'string', enum: ['awaiting-consent', 'linked', 'declined'] },
    invitedAt: { type: 'string', format: 'date-time' },
    invitedByName: { type: 'string', nullable: true },
    respondedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const enrollmentRequest = {
  type: 'object',
  properties: {
    id: objectId,
    status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
    studentNote: { type: 'string', nullable: true },
    hasProof: { type: 'boolean' },
    proofFileName: { type: 'string', nullable: true },
    proofMimeType: { type: 'string', nullable: true },
    decisionNote: { type: 'string', nullable: true },
    decidedAt: { type: 'string', format: 'date-time', nullable: true },
    student: { type: 'object', properties: { id: objectId, firstName: { type: 'string' }, lastName: { type: 'string' }, email: { type: 'string' } } },
    course: { type: 'object', properties: { id: objectId, title: { type: 'string' }, code: { type: 'string' } } },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const session = {
  type: 'object',
  properties: {
    user: { $ref: '#/components/schemas/AuthUser' },
    tokens: { $ref: '#/components/schemas/AuthTokens' },
  },
};

export const paths = {
  // ---- Who am I ----------------------------------------------------------
  '/admin/me': {
    get: op({
      tag: ADMIN,
      summary: 'Current admin, their permissions and the officer templates',
      description: ANY_ADMIN,
      responses: {
        ...ok('Admin identity', {
          data: {
            type: 'object',
            properties: {
              user,
              isSuperAdmin: { type: 'boolean' },
              permissions: permissionKeys,
              templates: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, keys: permissionKeys } } },
            },
          },
          example: { isSuperAdmin: true, permissions: OFFICER_PERMISSION_KEY_VALUES, templates: OFFICER_TEMPLATES.slice(0, 1) },
        }),
        ...errors('uf'),
      },
    }),
  },

  // ---- People --------------------------------------------------------------
  '/admin/users': {
    get: op({ tag: ADMIN, summary: 'List every account in the institution', description: SCOPE_NOTE('users.view'), responses: { ...ok('Accounts', { data: { type: 'array', items: user } }), ...errors('uf') } }),
  },
  '/admin/users/{userId}/active': {
    patch: op({
      tag: ADMIN,
      summary: 'Pause or re-activate an account',
      description: `${SCOPE_NOTE('users.manage')} A paused account cannot sign in. You cannot pause yourself or the super admin.`,
      parameters: pathParams('userId'),
      requestBody: body(s.setActive),
      responses: { ...ok('Updated account', { data: user }), ...errors('vufn') },
    }),
  },
  '/admin/users/{userId}/role': {
    patch: op({
      tag: ADMIN,
      summary: 'Change an account role',
      description: SCOPE_NOTE('users.manage'),
      parameters: pathParams('userId'),
      requestBody: body(s.changeRole),
      responses: { ...ok('Updated account', { data: user }), ...errors('vufn') },
    }),
  },
  '/admin/users/{userId}/academic-number': {
    patch: op({
      tag: ADMIN,
      summary: 'Set or clear the academic (student / staff) number',
      description: SCOPE_NOTE('users.manage'),
      parameters: pathParams('userId'),
      requestBody: body(s.academicNumber),
      responses: { ...ok('Updated account', { data: user }), ...errors('vufnc') },
    }),
  },
  '/admin/users/{userId}/study-year': {
    patch: op({
      tag: ADMIN,
      summary: "Set or clear a student's study year (1-4)",
      description: `${SCOPE_NOTE('users.manage')} The study year decides which courses a student can join without a request.`,
      parameters: pathParams('userId'),
      requestBody: body(s.studyYear),
      responses: { ...ok('Updated account', { data: user }), ...errors('vufn') },
    }),
  },

  // ---- Admin team ------------------------------------------------------------
  '/admin/officers': {
    get: op({ tag: ADMIN, summary: 'List the admin team (all institution admins)', description: SUPER_NOTE, responses: { ...ok('Admins', { data: { type: 'array', items: user } }), ...errors('uf') } }),
    post: op({
      tag: ADMIN,
      summary: 'Add an officer and email them an invitation',
      description: `${SUPER_NOTE} Give either a \`templateId\` or explicit \`keys\` (templateId "custom" = use keys). The new officer receives an invitation email to set a password.`,
      requestBody: body(s.createOfficer),
      responses: {
        ...ok('Officer created', {
          status: 201,
          data: {
            type: 'object',
            properties: {
              ...user.properties,
              permissions: permissionKeys,
              invited: { type: 'boolean' },
              emailStatus: invitation.properties.emailStatus,
            },
          },
        }),
        ...errors('vufc'),
      },
    }),
  },
  '/admin/officers/{userId}/template': {
    patch: op({
      tag: ADMIN,
      summary: "Replace an officer's permissions with a template",
      description: SUPER_NOTE,
      parameters: pathParams('userId'),
      requestBody: body(s.template),
      responses: { ...ok('Updated officer', { data: { type: 'object', properties: { ...user.properties, permissions: permissionKeys } } }), ...errors('vufn') },
    }),
  },
  '/admin/officers/{userId}/scopes': {
    patch: op({
      tag: ADMIN,
      summary: "Set an officer's exact permission keys",
      description: SUPER_NOTE,
      parameters: pathParams('userId'),
      requestBody: body(s.scopes),
      responses: { ...ok('Updated officer', { data: { type: 'object', properties: { ...user.properties, permissions: permissionKeys } } }), ...errors('vufn') },
    }),
  },

  // ---- Bulk invitations ----------------------------------------------------------
  '/admin/imports': {
    get: op({
      tag: ADMIN,
      summary: 'Import history',
      description: SCOPE_NOTE('bulk.import'),
      responses: {
        ...ok('Batches, newest first', {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: objectId,
                fileName: { type: 'string' },
                createdByName: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                confirmedAt: { type: 'string', format: 'date-time', nullable: true },
                status: { type: 'string', enum: ['staged', 'confirmed'] },
                rows: { type: 'array', items: importRow },
                counts: importCounts,
              },
            },
          },
        }),
        ...errors('uf'),
      },
    }),
    post: op({
      tag: ADMIN,
      summary: 'Stage a list of people (step 1 of 2)',
      description: `${SCOPE_NOTE('bulk.import')} Nothing is sent yet: every row is checked and marked new / existing / error. Up to 500 rows. The client parses the CSV/Excel file and sends the rows.`,
      requestBody: body(s.stageImport),
      responses: {
        ...ok('Staged batch with a verdict per row', {
          status: 201,
          data: { type: 'object', properties: { id: objectId, fileName: { type: 'string' }, rows: { type: 'array', items: importRow }, counts: importCounts, status: { type: 'string', example: 'staged' } } },
        }),
        ...errors('vufr'),
      },
    }),
  },
  '/admin/imports/{batchId}/confirm': {
    post: op({
      tag: ADMIN,
      summary: 'Confirm a staged batch (step 2 of 2): send invitation emails',
      description: `${SCOPE_NOTE('bulk.import')} "new" rows get an invitation with a personal link (/?invite=TOKEN in the web app); "existing" rows are enrolled in their courses directly.`,
      parameters: pathParams('batchId'),
      responses: {
        ...ok('Result', {
          data: {
            type: 'object',
            properties: {
              id: objectId,
              newCount: { type: 'integer' },
              existingCount: { type: 'integer' },
              errorCount: { type: 'integer' },
              emails: { type: 'object', properties: { sent: { type: 'integer' }, logged: { type: 'integer' }, failed: { type: 'integer' } } },
            },
          },
        }),
        ...errors('vufn'),
      },
    }),
  },
  '/admin/imports/{batchId}': {
    delete: op({
      tag: ADMIN,
      summary: 'Discard a staged batch that was not confirmed',
      description: SCOPE_NOTE('bulk.import'),
      parameters: pathParams('batchId'),
      responses: { ...ok('Discarded', { data: { type: 'object', properties: { id: objectId, discarded: { type: 'boolean' } } } }), ...errors('vufn') },
    }),
  },
  '/admin/invitations': {
    get: op({
      tag: ADMIN,
      summary: 'List invitations and their email status',
      description: SCOPE_NOTE('bulk.import'),
      parameters: queryFromZod(s.invitationsQuery),
      responses: { ...ok('Invitations', { data: { type: 'array', items: invitation } }), ...errors('vuf') },
    }),
  },
  '/admin/invitations/{invitationId}/resend': {
    post: op({
      tag: ADMIN,
      summary: 'Send the invitation email again (new link, new expiry)',
      description: `${SCOPE_NOTE('bulk.import')} Only pending invitations. The previous link stops working.`,
      parameters: pathParams('invitationId'),
      responses: { ...ok('Sent', { data: { type: 'object', properties: { id: objectId, emailStatus: invitation.properties.emailStatus } } }), ...errors('vufnr') },
    }),
  },
  '/admin/invitations/{invitationId}/revoke': {
    post: op({
      tag: ADMIN,
      summary: 'Cancel a pending invitation',
      description: `${SCOPE_NOTE('bulk.import')} Opening the link afterwards shows "cancelled".`,
      parameters: pathParams('invitationId'),
      responses: { ...ok('Cancelled', { data: { type: 'object', properties: { id: objectId, status: { type: 'string', example: 'revoked' } } } }), ...errors('vufn') },
    }),
  },

  // ---- Join requests ---------------------------------------------------------------
  '/admin/requests': {
    get: op({
      tag: ADMIN,
      summary: 'Requests from students to join a course outside their year',
      description: SCOPE_NOTE('requests.review'),
      parameters: queryFromZod(s.requestsQuery),
      responses: {
        ...ok('Page of requests', {
          data: { type: 'object', properties: { items: { type: 'array', items: enrollmentRequest }, total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' } } },
        }),
        ...errors('vuf'),
      },
    }),
  },
  '/admin/requests/{requestId}/proof': {
    get: op({
      tag: ADMIN,
      summary: 'Download the proof file a student attached to a request',
      description: SCOPE_NOTE('requests.review'),
      parameters: pathParams('requestId'),
      responses: {
        ...ok('Attachment', {
          data: {
            type: 'object',
            properties: {
              fileName: { type: 'string' },
              mimeType: { type: 'string' },
              size: { type: 'integer', nullable: true },
              data: { type: 'string', description: 'File content exactly as uploaded by the student (base64).' },
            },
          },
        }),
        ...errors('ufn'),
      },
    }),
  },
  '/admin/requests/{requestId}/decision': {
    post: op({
      tag: ADMIN,
      summary: 'Approve or reject a join request',
      description: `${SCOPE_NOTE('requests.review')} A note is required when rejecting. Approving enrolls the student. The student is told by email either way.`,
      parameters: pathParams('requestId'),
      requestBody: body(s.decideRequest),
      responses: {
        ...ok('Decision saved', { data: { type: 'object', properties: { ...enrollmentRequest.properties, enrollmentCreated: { type: 'boolean', description: 'false when the student was already enrolled.' } } } }),
        ...errors('vufnc'),
      },
    }),
  },

  // ---- Institution profile and settings ------------------------------------------------
  '/admin/profile': {
    get: op({ tag: ADMIN, summary: 'Institution profile shown on the admin home page', description: ANY_ADMIN, responses: { ...ok('Profile', { data: profileView }), ...errors('uf') } }),
    patch: op({
      tag: ADMIN,
      summary: 'Update the institution profile',
      description: `${SCOPE_NOTE('settings.manage')} Send only the fields that change. \`faculties\` replaces the whole list (max 24).`,
      requestBody: body(s.profilePatch),
      responses: { ...ok('Updated profile', { data: profileView }), ...errors('vufc') },
    }),
  },
  '/admin/settings': {
    get: op({ tag: ADMIN, summary: 'Sign-up, course-creation and AI source settings', description: SCOPE_NOTE('settings.manage'), responses: { ...ok('Settings', { data: settingsView }), ...errors('uf') } }),
    patch: op({
      tag: ADMIN,
      summary: 'Update settings',
      description: `${SCOPE_NOTE('settings.manage')} emailDomains decides which emails belong to the institution.`,
      requestBody: body(s.settingsPatch),
      responses: { ...ok('Updated settings', { data: settingsView }), ...errors('vuf') },
    }),
  },

  // ---- Linking personal accounts ------------------------------------------------------------
  '/admin/link-candidates': {
    get: op({
      tag: ADMIN,
      summary: 'Personal accounts that use an institution email domain',
      description: `${SCOPE_NOTE('accounts.link')} \`invitation\` is the latest link invitation, or null.`,
      responses: {
        ...ok('Candidates', {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: objectId,
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                email: { type: 'string' },
                accountType: { type: 'string', example: 'individual' },
                createdAt: { type: 'string', format: 'date-time' },
                invitation: { ...linkInvitation, nullable: true },
              },
            },
          },
        }),
        ...errors('uf'),
      },
    }),
  },
  '/admin/link-invitations': {
    get: op({
      tag: ADMIN,
      summary: 'Link invitations sent by the institution',
      description: SCOPE_NOTE('accounts.link'),
      parameters: queryFromZod(s.linkInvitationsQuery),
      responses: { ...ok('Link invitations', { data: { type: 'array', items: linkInvitation } }), ...errors('vuf') },
    }),
    post: op({
      tag: ADMIN,
      summary: 'Ask a personal account to link to the institution',
      description: `${SCOPE_NOTE('accounts.link')} Nothing changes until the student accepts. Sending again after a decline resets the invitation.`,
      requestBody: body(s.sendLinkInvitation),
      responses: { ...ok('Invitation', { status: 201, data: linkInvitation }), ...errors('vufnc') },
    }),
  },

  // ---- Oversight --------------------------------------------------------------------------------
  '/admin/audit': {
    get: op({
      tag: ADMIN,
      summary: 'Activity log of the admin team',
      description: SCOPE_NOTE('audit.view'),
      parameters: queryFromZod(s.auditQuery),
      responses: {
        ...ok('Page of events', {
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: objectId,
                    type: { type: 'string' },
                    scope: { type: 'string', enum: OFFICER_PERMISSION_KEY_VALUES },
                    actorName: { type: 'string' },
                    summary: bilingual,
                    detail: { type: 'object', nullable: true },
                    at: { type: 'string', format: 'date-time' },
                  },
                },
              },
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              scopes: permissionKeys,
            },
          },
        }),
        ...errors('vuf'),
      },
    }),
  },
  '/admin/health': {
    get: op({
      tag: ADMIN,
      summary: 'What needs attention right now',
      description: ANY_ADMIN,
      responses: {
        ...ok('Status', {
          data: {
            type: 'object',
            properties: {
              pendingRequests: { type: 'integer' },
              invitations: { type: 'object', properties: { pending: { type: 'integer' }, oldestWaitingDays: { type: 'integer' } } },
              awaitingLinkConsents: { type: 'integer' },
              courses: { type: 'object', properties: { total: { type: 'integer' }, withoutMaterials: { type: 'integer' }, withoutMaterialsCodes: { type: 'array', items: { type: 'string' } } } },
              officers: { type: 'object', properties: { total: { type: 'integer' }, activeLast30d: { type: 'integer' } } },
              contract: { type: 'object', properties: { endsAt: { type: 'string', format: 'date-time', nullable: true }, daysRemaining: { type: 'integer', nullable: true }, expired: { type: 'boolean' } } },
            },
          },
          example: {
            pendingRequests: 1,
            invitations: { pending: 0, oldestWaitingDays: 0 },
            awaitingLinkConsents: 0,
            courses: { total: 2, withoutMaterials: 0, withoutMaterialsCodes: [] },
            officers: { total: 3, activeLast30d: 0 },
            contract: { endsAt: '2027-08-31T00:00:00.000Z', daysRemaining: 336, expired: false },
          },
        }),
        ...errors('uf'),
      },
    }),
  },
  '/admin/analytics': {
    get: op({
      tag: ADMIN,
      summary: 'Usage per faculty and across the institution',
      description: SCOPE_NOTE('analytics.view'),
      responses: {
        ...ok('Snapshot', {
          data: {
            type: 'object',
            properties: {
              asOf: { type: 'string', format: 'date-time' },
              faculties: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: bilingual,
                    doctors: { type: 'integer' },
                    activeDoctors: { type: 'integer' },
                    students: { type: 'integer' },
                    courses: { type: 'integer' },
                    coursesWithoutMaterials: { type: 'integer' },
                    aiCalls30d: { type: 'integer' },
                    masteryAvg: { type: 'number', nullable: true },
                  },
                },
              },
              coverageGaps: { type: 'array', items: { type: 'object' } },
              usage: { type: 'object', properties: { aiCalls30d: { type: 'integer' }, estCostUsd: { type: 'number' }, activeDoctorsPct: { type: 'number' } } },
            },
          },
        }),
        ...errors('uf'),
      },
    }),
  },

  // ---- Public invitation links -------------------------------------------------------------------
  '/invitations/{token}': {
    get: op({
      tag: INVITE,
      auth: false,
      summary: 'Open an emailed invitation link',
      description:
        'Public. Shows who is invited, by which institution, and to which courses. ' +
        'Errors: 404 unknown link, 409 already used, 403 cancelled or expired.',
      parameters: pathParams(['token', 'The token from the invitation email link (?invite=TOKEN).']),
      responses: {
        ...ok('Invitation preview', {
          data: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              role: { type: 'string' },
              institutionName: { type: 'string' },
              invitedByName: { type: 'string', nullable: true },
              courses: { type: 'array', items: { type: 'object', properties: { id: objectId, code: { type: 'string', nullable: true }, title: { type: 'string' } } } },
              expiresAt: { type: 'string', format: 'date-time', nullable: true },
              accountExists: { type: 'boolean', description: 'true = this email already has an account; the person should sign in instead.' },
            },
          },
        }),
        ...errors('vfncr'),
      },
    }),
  },
  '/invitations/{token}/accept': {
    post: op({
      tag: INVITE,
      auth: false,
      summary: 'Accept an invitation: set a password and sign in',
      description: 'Public. Creates (or activates) the account. Owning the link proves the email, so the account starts verified. Returns a signed-in session.',
      parameters: pathParams(['token', 'The token from the invitation email link.']),
      requestBody: body(s.acceptInvitation),
      responses: { ...ok('Signed in', { status: 201, data: session }), ...errors('vfncr') },
    }),
  },

  // ---- Student side of account linking -------------------------------------------------------------
  '/link-invitations': {
    get: op({
      tag: INVITE,
      summary: 'Link invitations waiting for the signed-in student',
      responses: {
        ...ok('Invitations', {
          data: {
            type: 'array',
            items: { type: 'object', properties: { id: objectId, institutionId: { ...objectId, nullable: true }, institutionName: { type: 'string' }, invitedAt: { type: 'string', format: 'date-time' } } },
          },
        }),
        ...errors('u'),
      },
    }),
  },
  '/link-invitations/{invitationId}/respond': {
    post: op({
      tag: INVITE,
      summary: 'Accept or decline linking a personal account to an institution',
      description: 'Accepting turns the account institutional (personal courses are kept) and returns a fresh session, because the account changes.',
      parameters: pathParams('invitationId'),
      requestBody: body(s.linkRespond),
      responses: {
        ...ok('Result', {
          data: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['linked', 'declined'] },
              institutionId: objectId,
              institutionName: { type: 'string' },
              user: { $ref: '#/components/schemas/AuthUser' },
              tokens: { $ref: '#/components/schemas/AuthTokens' },
            },
          },
        }),
        ...errors('vufnc'),
      },
    }),
  },
};
