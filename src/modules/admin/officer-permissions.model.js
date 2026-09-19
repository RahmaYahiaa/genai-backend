import mongoose from 'mongoose';
import { OFFICER_PERMISSION_KEY_VALUES } from './admin.constants.js';

// One row per institution-admin officer (FR-ADM-01): the flat scope list the
// officer may act inside. Super admins carry no row — `User.isSuperAdmin`
// bypasses key checks entirely.
const officerPermissionsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    keys: { type: [String], enum: OFFICER_PERMISSION_KEY_VALUES, default: [] },
    // Who last edited this row (super admin) — echoed into the audit log.
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

officerPermissionsSchema.index({ userId: 1 }, { unique: true });
officerPermissionsSchema.index({ institutionId: 1 });

const OfficerPermissions = mongoose.model('OfficerPermissions', officerPermissionsSchema);

export default OfficerPermissions;
