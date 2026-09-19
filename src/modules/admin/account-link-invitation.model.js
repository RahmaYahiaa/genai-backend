import mongoose from 'mongoose';

const accountLinkInvitationSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    status: {
      type: String,
      enum: ['awaiting-consent', 'linked', 'declined'],
      default: 'awaiting-consent',
    },
    invitedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    invitedByName: { type: String, trim: true, maxlength: 200, default: '' },
    respondedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

accountLinkInvitationSchema.index({ institutionId: 1, userId: 1 }, { unique: true });
accountLinkInvitationSchema.index({ institutionId: 1, status: 1, createdAt: -1 });
accountLinkInvitationSchema.index({ userId: 1, status: 1 });

const AccountLinkInvitation = mongoose.model('AccountLinkInvitation', accountLinkInvitationSchema);

export default AccountLinkInvitation;
