import mongoose from 'mongoose';
import { ROLES, LANGUAGES } from '../../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    // Excluded from every query by default; only the login path selects it.
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: Object.values(ROLES), required: true },
    // Tenant scope: enforced server-side in every authorization query.
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
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
    institutionId: user.institutionId.toString(),
    languagePreference: user.languagePreference,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export default User;