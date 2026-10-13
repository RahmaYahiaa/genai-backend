import mongoose from 'mongoose';

/**
 * Our own record of every voice session we opened for a student. It is the
 * ownership check: a token is minted or a facade lookup is answered only for
 * a student who started that session through this API.
 */
const voiceSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lessonId: { type: String, default: null, maxlength: 120 },
    topic: { type: String, default: null, maxlength: 200 },
    language: { type: String, default: 'en', maxlength: 16 },
  },
  { timestamps: true },
);

voiceSessionSchema.index({ studentId: 1, courseId: 1, createdAt: -1 });

export const VoiceSession = mongoose.model('VoiceSession', voiceSessionSchema);
