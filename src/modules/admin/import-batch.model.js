import mongoose from 'mongoose';

const rowSchema = new mongoose.Schema(
  {
    row: { type: Number, required: true },
    firstName: { type: String, trim: true, maxlength: 100, default: '' },
    lastName: { type: String, trim: true, maxlength: 100, default: '' },
    email: { type: String, lowercase: true, trim: true, default: '' },
    role: { type: String, trim: true, default: '' },
    courseCodes: { type: [String], default: [] },
    verdict: { type: String, enum: ['new', 'existing', 'error'], required: true },
    errorReason: {
      en: { type: String, default: null, maxlength: 300 },
      ar: { type: String, default: null, maxlength: 300 },
    },
    unresolvableCourseCodes: { type: [String], default: [] },
  },
  { _id: false },
);

const importBatchSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    fileName: { type: String, required: true, trim: true, maxlength: 200 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true, trim: true, maxlength: 200 },
    rows: { type: [rowSchema], default: [] },
    status: { type: String, enum: ['staged', 'confirmed', 'discarded'], default: 'staged', index: true },
    confirmedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
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

importBatchSchema.index({ institutionId: 1, createdAt: -1 });

const ImportBatch = mongoose.model('ImportBatch', importBatchSchema);

export default ImportBatch;
