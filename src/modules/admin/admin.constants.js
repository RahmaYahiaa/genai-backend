// Institution admin governance constants (FR-ADM-01).
// The User.role enum keeps its single `institution_admin` value; delegated
// officer authority lives here, in a separate permissions collection, so
// templates never touch the core role.

export const OFFICER_PERMISSION_KEYS = {
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  BULK_IMPORT: 'bulk.import',
  REQUESTS_REVIEW: 'requests.review',
  ACCOUNTS_LINK: 'accounts.link',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
  ANALYTICS_VIEW: 'analytics.view',
};

export const OFFICER_PERMISSION_KEY_VALUES = Object.values(OFFICER_PERMISSION_KEYS);

// Ready-made permission templates the super admin assigns in one click;
// afterwards any single key may be toggled manually (stored as the same flat
// key list, so a customised officer is just a row with edited keys).
export const OFFICER_TEMPLATES = [
  {
    id: 'tpl-admissions',
    name: 'Admissions officer',
    description:
      'Approves out-of-year enrollment requests, runs bulk invitations and links individual accounts.',
    keys: [
      OFFICER_PERMISSION_KEYS.USERS_VIEW,
      OFFICER_PERMISSION_KEYS.BULK_IMPORT,
      OFFICER_PERMISSION_KEYS.REQUESTS_REVIEW,
      OFFICER_PERMISSION_KEYS.ACCOUNTS_LINK,
      OFFICER_PERMISSION_KEYS.AUDIT_VIEW,
    ],
  },
  {
    id: 'tpl-content',
    name: 'Content officer',
    description:
      'Watches coverage gaps and AI-grounding policy across the whole academic structure.',
    keys: [
      OFFICER_PERMISSION_KEYS.USERS_VIEW,
      OFFICER_PERMISSION_KEYS.SETTINGS_MANAGE,
      OFFICER_PERMISSION_KEYS.ANALYTICS_VIEW,
      OFFICER_PERMISSION_KEYS.AUDIT_VIEW,
    ],
  },
];

export const ADMIN_AUDIT_TYPES = {
  USER_ACTIVATED: 'user.activated',
  USER_DEACTIVATED: 'user.deactivated',
  ROLE_CHANGED: 'role.changed',
  PERMISSIONS_CHANGED: 'permissions.changed',
  OFFICER_ADDED: 'officer.added',
  BULK_IMPORTED: 'bulk.imported',
  REQUEST_DECIDED: 'request.decided',
  SETTINGS_CHANGED: 'settings.changed',
  ACCOUNT_LINKED: 'account.linked',
};

export const ADMIN_AUDIT_TYPE_VALUES = Object.values(ADMIN_AUDIT_TYPES);
