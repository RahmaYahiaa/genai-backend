import mongoose from 'mongoose';

const analyticsSnapshotSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      unique: true,
    },
    computedAt: { type: Date, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

const AnalyticsSnapshot = mongoose.model('AnalyticsSnapshot', analyticsSnapshotSchema);

export function toPublicAnalyticsSnapshot(document) {
  return {
    courseId: document.courseId.toString(),
    computedAt: document.computedAt,
    ...(document.payload ?? {}),
  };
}

export default AnalyticsSnapshot;