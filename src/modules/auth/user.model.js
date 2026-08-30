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
    isActive: { type: Boolean, default: true },
    // Incremented on logout to revoke every previously issued token instantly.
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date, default: null },
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
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export default User;