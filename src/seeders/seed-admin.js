// ─────────────────────────────────────────────────────────────────────────────
// Standalone INSTITUTION-ADMIN seeder (FR-ADM-*). Runs alongside the main
// seeder, never replaces it: everything here is an idempotent upsert — no
// drops, no resets, and nothing existing is ever deleted. Run with:
//   npm run seed:admin
// Safe to re-run any number of times.
// ─────────────────────────────────────────────────────────────────────────────
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { LANGUAGES, ROLES } from '../config/constants.js';
import { authService } from '../modules/auth/index.js';
import User from '../modules/auth/user.model.js';
import Institution from '../modules/academic-structure/institution.model.js';
import { OFFICER_PERMISSION_KEYS } from '../modules/admin/admin.constants.js';
import OfficerPermissions from '../modules/admin/officer-permissions.model.js';

const DEMO_PASSWORD = 'Passw0rd1';
const SUPER_ADMIN_EMAIL = 'admin@menoufia.edu.eg';
const CONTRACT_ENDS_AT = new Date('2027-08-31');

const OFFICERS = [
  {
    email: 'heba.salah@menoufia.edu.eg',
    firstName: 'Heba',
    lastName: 'Salah',
    academicNumber: 'EMP-0117',
    keys: [
      OFFICER_PERMISSION_KEYS.USERS_VIEW,
      OFFICER_PERMISSION_KEYS.BULK_IMPORT,
      OFFICER_PERMISSION_KEYS.REQUESTS_REVIEW,
      OFFICER_PERMISSION_KEYS.ACCOUNTS_LINK,
      OFFICER_PERMISSION_KEYS.AUDIT_VIEW,
    ],
  },
  {
    email: 'tamer.elgendy@menoufia.edu.eg',
    firstName: 'Tamer',
    lastName: 'Elgendy',
    academicNumber: 'EMP-0124',
    // Hand-tuned template: content officer minus settings management.
    keys: [
      OFFICER_PERMISSION_KEYS.USERS_VIEW,
      OFFICER_PERMISSION_KEYS.ANALYTICS_VIEW,
      OFFICER_PERMISSION_KEYS.AUDIT_VIEW,
    ],
  },
];

const STUDENTS = [
  { email: 'sarah.rashidi@menoufia.edu.eg', firstName: 'Sarah', lastName: 'Al-Rashidi', academicNumber: '202341872' },
];

function log(message) {
  console.log(`[seed:admin] ${message}`);
}

async function ensureUser({ email, firstName, lastName, role, institutionId, academicNumber }) {
  const existing = await User.findOne({ email });
  if (existing) {
    const patch = {};
    if (academicNumber && existing.academicNumber !== academicNumber) patch.academicNumber = academicNumber;
    if (Object.keys(patch).length) await User.updateOne({ _id: existing._id }, { $set: patch });
    log(`exists: ${email} (${role})`);
    return existing;
  }
  const { user } = await authService.register({
    email,
    firstName,
    lastName,
    role,
    institutionId,
    languagePreference: LANGUAGES.ENGLISH,
    password: DEMO_PASSWORD,
  });
  if (academicNumber) await User.updateOne({ email }, { $set: { academicNumber } });
  log(`created: ${email} (${role})`);
  return user;
}

async function main() {
  await connectDatabase();

  const superAdmin = await User.findOne({ email: SUPER_ADMIN_EMAIL });
  if (!superAdmin) {
    log(`anchor admin ${SUPER_ADMIN_EMAIL} not found — run the main seeder first (npm run seed), then re-run this one.`);
    await disconnectDatabase();
    process.exit(1);
  }

  if (superAdmin.isSuperAdmin !== true || superAdmin.academicNumber !== 'EMP-0001') {
    await User.updateOne({ _id: superAdmin._id }, { $set: { isSuperAdmin: true, academicNumber: 'EMP-0001' } });
  }
  log(`super admin: ${SUPER_ADMIN_EMAIL} (isSuperAdmin=true)`);

  const institutionId = superAdmin.institutionId;
  if (!institutionId) {
    log('the anchor admin has no institution — fix the main seed before continuing.');
    await disconnectDatabase();
    process.exit(1);
  }

  for (const officer of OFFICERS) {
    const user = await ensureUser({ ...officer, role: ROLES.INSTITUTION_ADMIN, institutionId });
    await OfficerPermissions.findOneAndUpdate(
      { userId: user._id ?? user.id },
      { $set: { institutionId, keys: officer.keys, updatedBy: superAdmin._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    log(`scopes: ${officer.email} -> [${officer.keys.join(', ')}]`);
  }

  for (const student of STUDENTS) {
    await ensureUser({ ...student, role: ROLES.STUDENT, institutionId });
  }

  await Institution.updateOne(
    { _id: institutionId },
    { $set: { contractEndsAt: CONTRACT_ENDS_AT, 'settings.allowDoctorCourseCreation': true } },
  );
  log(`institution: contract ends ${CONTRACT_ENDS_AT.toISOString().slice(0, 10)}, doctor course creation = on`);

  log('done. Demo logins (password Passw0rd1):');
  log('   super admin   admin@menoufia.edu.eg');
  log('   officer       heba.salah@menoufia.edu.eg   (admissions template)');
  log('   officer       tamer.elgendy@menoufia.edu.eg (custom: users.view, analytics.view, audit.view)');
  log('   student       sarah.rashidi@menoufia.edu.eg');
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error('[seed:admin] failed:', error.message);
  try {
    await disconnectDatabase();
  } catch {
    // best effort
  }
  process.exit(1);
});
