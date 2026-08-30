import mongoose from 'mongoose';
import { LANGUAGES, MATERIAL_SOURCE_TYPES } from '../../config/constants.js';

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
    settings: {
      // When false, users cannot self-register into this institution.
      allowSelfRegistration: { type: Boolean, default: true },
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

export default Institution;