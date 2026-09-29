import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', default: null },
    // Set for officer invitations: the (inactive) account created by the super admin.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    invitedByName: { type: String, default: null },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: ['student', 'instructor', 'officer'], required: true },
    courseIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Course', default: [] },
    studyYear: { type: Number, min: 1, max: 4, default: null },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending', index: true },
    enrolledUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
    // Email invitation link: only a SHA-256 of the token is stored.
    tokenHash: { type: String, default: null, index: true, select: false },
    expiresAt: { type: Date, default: null },
    lastSentAt: { type: Date, default: null },
    sendCount: { type: Number, default: 0 },
    // 'sent' (delivered to SMTP), 'logged' (no SMTP configured), 'failed', or null (not sent yet).
    emailStatus: { type: String, enum: ['sent', 'logged', 'failed', null], default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.tokenHash;
        return ret;
      },
    },
  },
);

invitationSchema.index({ institutionId: 1, status: 1, createdAt: -1 });
invitationSchema.index({ email: 1, status: 1 });

const Invitation = mongoose.model('Invitation', invitationSchema);

export default Invitation;
