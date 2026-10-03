import mongoose from 'mongoose';

// A study plan made by Plany for one student, one course and one exam date.
export const TASK_TYPES = ['check', 'learn', 'practice', 'quiz', 'review', 'reassess'];
export const PLAN_SOURCES = ['lerna', 'ai', 'rules'];

const resultSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 1, default: null },
    answered: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    feeling: { type: String, enum: ['clear', 'confused', null], default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const lessonSchema = new mongoose.Schema(
  {
    explanation: String,
    example: { problem: String, solution: String },
    keyPoints: [String],
    flashcards: [{ _id: false, front: String, back: String }],
    exercises: [{ _id: false, question: String, answer: String }],
    source: { type: String, enum: PLAN_SOURCES },
  },
  { _id: false },
);

const taskSchema = new mongoose.Schema({
  type: { type: String, enum: TASK_TYPES, required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, required: true },
  topicTitle: { type: String, required: true },
  minutes: { type: Number, min: 5, max: 240, required: true },
  title: { type: String, required: true, maxlength: 200 },
  why: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['pending', 'in_progress', 'done', 'skipped'], default: 'pending' },
  // The practice / reassessment session that runs this task.
  refKind: { type: String, enum: ['practice', 'reassessment', null], default: null },
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  lesson: { type: lessonSchema, default: null },
  result: { type: resultSchema, default: null },
});

const daySchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  title: { type: String, default: '' },
  focus: { type: String, default: '' },
  tasks: { type: [taskSchema], default: [] },
});

const focusTopicSchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: String,
    reason: String,
    levelAtStart: String,
    scoreAtStart: Number,
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    kind: { type: String, default: 'adapt' },
    decision: String,
    message: String,
    source: { type: String, enum: PLAN_SOURCES },
  },
  { _id: false },
);

const studyPlanSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    courseTitle: String,
    goal: { type: String, default: '', maxlength: 500 },
    examDate: { type: String, required: true },
    dailyMinutes: { type: Number, required: true },
    language: { type: String, default: 'en' },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active', index: true },
    source: { type: String, enum: PLAN_SOURCES, required: true },
    summary: { type: String, default: '' },
    focusTopics: { type: [focusTopicSchema], default: [] },
    days: { type: [daySchema], default: [] },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true },
);

studyPlanSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    for (const day of ret.days ?? []) {
      day.id = String(day._id);
      delete day._id;
      for (const task of day.tasks ?? []) {
        task.id = String(task._id);
        delete task._id;
      }
    }
    return ret;
  },
});

export default mongoose.models.StudyPlan || mongoose.model('StudyPlan', studyPlanSchema);
