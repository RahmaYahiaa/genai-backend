import mongoose from 'mongoose';
import { ADMIN_AUDIT_TYPE_VALUES, OFFICER_PERMISSION_KEY_VALUES } from './admin.constants.js';

const adminAuditEventSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    scope: { type: String, enum: OFFICER_PERMISSION_KEY_VALUES, required: true, index: true },
    type: { type: String, enum: ADMIN_AUDIT_TYPE_VALUES, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true, trim: true, maxlength: 200 },
    summary: {
      en: { type: String, required: true, maxlength: 600 },
      ar: { type: String, required: true, maxlength: 600 },
    },
    detail: {
      en: { type: String, default: null, maxlength: 1200 },
      ar: { type: String, default: null, maxlength: 1200 },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

adminAuditEventSchema.index({ institutionId: 1, createdAt: -1 });

const AdminAuditEvent = mongoose.model('AdminAuditEvent', adminAuditEventSchema);

export default AdminAuditEvent;
