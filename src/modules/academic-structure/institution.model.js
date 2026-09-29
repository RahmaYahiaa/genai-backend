import mongoose from 'mongoose';
import { LANGUAGES, MATERIAL_SOURCE_TYPES } from '../../config/constants.js';

/**
 * Institution is the tenant root: every user, course, and analytics query is
 * scoped by it. Kept lean for the current phase; settings live in one embedded
 * sub-document so new governance knobs can be added without migrations.
 */
const institutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    // Lowercased name used for case-insensitive uniqueness checks.
    nameKey: { type: String, required: true, unique: true, index: true },
    country: { type: String, trim: true, maxlength: 100 },
    defaultLanguage: {
      type: String,
      enum: Object.values(LANGUAGES),
      default: LANGUAGES.ENGLISH,
    },
    // Verified email domains used to auto-verify institutional self-registration
    // (e.g. "zu.edu.eg"). Empty list = no domain verification enforced.
    emailDomains: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    // FR-ADM-08 — platform contract end date shown on the admin health screen.
    contractEndsAt: { type: Date, default: null },
    // Public face of the institution (shown on the institution home page).
    profile: {
      shortName: { type: String, trim: true, maxlength: 60, default: '' },
      tagline: { type: String, trim: true, maxlength: 160, default: '' },
      about: { type: String, trim: true, maxlength: 2000, default: '' },
      mission: { type: String, trim: true, maxlength: 600, default: '' },
      vision: { type: String, trim: true, maxlength: 600, default: '' },
      foundedYear: { type: Number, min: 800, max: 2100, default: null },
      city: { type: String, trim: true, maxlength: 100, default: '' },
      address: { type: String, trim: true, maxlength: 240, default: '' },
      website: { type: String, trim: true, maxlength: 200, default: '' },
      contactEmail: { type: String, trim: true, maxlength: 200, default: '' },
      phone: { type: String, trim: true, maxlength: 40, default: '' },
      faculties: {
        type: [
          {
            _id: false,
            name: { type: String, trim: true, maxlength: 120, required: true },
            description: { type: String, trim: true, maxlength: 300, default: '' },
          },
        ],
        default: [],
      },
    },
    settings: {
      // When false, users cannot self-register into this institution.
      allowSelfRegistration: { type: Boolean, default: true },
      // FR-ADM-08 — institution-wide gate on instructors creating course
      // shells themselves; off = courses arrive only from admin/sync.
      allowDoctorCourseCreation: { type: Boolean, default: true },
      // Supplementary (non-official) source types institutions permit in RAG retrieval.
      allowedSupplementalSourceTypes: {
        type: [String],
        enum: Object.values(MATERIAL_SOURCE_TYPES),
        default: [MATERIAL_SOURCE_TYPES.TEXTBOOK, MATERIAL_SOURCE_TYPES.EXTERNAL_REFERENCE],
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.nameKey;
        return ret;
      },
    },
  },
);

const Institution = mongoose.model('Institution', institutionSchema);

/** Maps a lean institution document to the public API shape. */
export function toPublicInstitution(institution) {
  return {
    id: institution._id.toString(),
    name: institution.name,
    country: institution.country ?? null,
    defaultLanguage: institution.defaultLanguage,
    emailDomains: institution.emailDomains ?? [],
    isActive: institution.isActive,
    settings: {
      allowSelfRegistration: institution.settings?.allowSelfRegistration ?? true,
      allowDoctorCourseCreation: institution.settings?.allowDoctorCourseCreation ?? true,
      allowedSupplementalSourceTypes: institution.settings?.allowedSupplementalSourceTypes ?? [],
    },
    createdAt: institution.createdAt,
    updatedAt: institution.updatedAt,
  };
}

export default Institution;