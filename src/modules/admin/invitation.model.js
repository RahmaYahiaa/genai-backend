import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: ['student', 'instructor'], required: true },
    courseIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Course', default: [] },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending', index: true },
    enrolledUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
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

invitationSchema.index({ institutionId: 1, status: 1, createdAt: -1 });
invitationSchema.index({ email: 1, status: 1 });

const Invitation = mongoose.model('Invitation', invitationSchema);

export default Invitation;
