import mongoose from 'mongoose';
import { LANGUAGES, ACCOUNT_TYPES, ROLES } from '../../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    // Excluded from every query by default; only the login path selects it.
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: Object.values(ROLES), required: true },
    // institutional = member of a tenant; individual = independent learner
    // whose learning space is personal (institutionId stays null).
    accountType: {
      type: String,
      enum: Object.values(ACCOUNT_TYPES),
      required: true,
      default: ACCOUNT_TYPES.INSTITUTIONAL,
    },
    // Tenant scope for institutional accounts; null for individual learners.
    // Enforced server-side in every authorization query.
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    // Persisted per profile so it survives across sessions (multilingual layer).
    languagePreference: {
      type: String,
      enum: Object.values(LANGUAGES),
      default: LANGUAGES.ENGLISH,
    },
    // Language the AI features answer in (tutor, study tools). Set from the
    // profile's AI preferences; null means "follow the account language".
    aiLanguage: {
      type: String,
      enum: [...['en', 'ar', 'fr', 'sw', 'ha', 'am', 'so', 'yo', 'ig', 'zu'], null],
      default: null,
    },
    // Plany study reminders (profile preference). One email a day at most,
    // only while the student has an active study plan.
    studyReminders: {
      enabled: { type: Boolean, default: true },
      time: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: '09:00' }, // HH:MM, 24h, student's timezone
      timezone: { type: String, default: 'Africa/Cairo', maxlength: 64 },
      lastSentOn: { type: String, default: null }, // YYYY-MM-DD in the student's timezone
    },
    isActive: { type: Boolean, default: true },
    // FR-ADM-01 — the tenant's super admin; bypasses officer-scope key checks
    // and alone manages officer permission rows. Officers keep this false and
    // carry an OfficerPermissions row instead.
    isSuperAdmin: { type: Boolean, default: false },
    // FR-ADM-04 — optional; academic number for students, employee number for
    // staff. Deactivated-flag manual verification never blocks login.
    academicNumber: { type: String, trim: true, maxlength: 40, default: null },
    // Study year for institutional students (computer-science faculties: 1-4).
    // Set by the admin (bulk import or per user); null when unknown.
    studyYear: { type: Number, min: 1, max: 4, default: null },
    // Incremented on logout to revoke every previously issued token instantly.
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date, default: null },
    // Email ownership. Accounts created by an admin / bulk import / seed are
    // trusted (default true); self-registered accounts start unverified and
    // confirm with a 6-digit code sent by email.
    emailVerified: { type: Boolean, default: true },
    emailVerifiedAt: { type: Date, default: null },
    // One active code per purpose; only its hash is stored.
    emailCodes: {
      type: [
        {
          _id: false,
          purpose: { type: String, enum: ['verify_email', 'reset_password'], required: true },
          codeHash: { type: String, required: true },
          expiresAt: { type: Date, required: true },
          attempts: { type: Number, default: 0 },
          sentAt: { type: Date, required: true },
        },
      ],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.emailCodes;
        return ret;
      },
    },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ institutionId: 1, role: 1 });

const User = mongoose.model('User', userSchema);

/**
 * Maps a user document (mongoose doc or lean object) to the public API shape.
 * Centralized so every surface (endpoints, middleware) returns the same shape.
 */
export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    accountType: user.accountType,
    institutionId: user.institutionId ? user.institutionId.toString() : null,
    languagePreference: user.languagePreference,
    aiLanguage: user.aiLanguage ?? null,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin === true,
    academicNumber: user.academicNumber ?? null,
    studyYear: user.studyYear ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    emailVerified: user.emailVerified !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export default User;