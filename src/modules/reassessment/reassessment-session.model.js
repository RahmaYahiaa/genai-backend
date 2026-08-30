import mongoose from 'mongoose';
import { MASTERY_LEVELS, QUESTION_DIFFICULTIES } from '../../config/constants.js';

/**
 * A reassessment session for one student on one course topic (flow steps
 * 17-19): a second chance to demonstrate understanding on a topic that the
 * deterministic learner model flagged as a gap. The mastery level at the
 * moment of creation is snapshotted (`masteryLevelBefore`) so the
 * learning-gain report stays traceable and explainable.
 *
 * Same governance split as diagnostics/practice: answers embed the AI
 * evaluation + generated feedback text, while the structured authoritative
 * outcome lives separately in learning_evidence (sourceType: "reassessment").
 */
const reassessmentQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, minlength: 8, maxlength: 1000 },
    difficulty: {
      type: String,
      enum: Object.values(QUESTION_DIFFICULTIES),
      required: true,
    },
    generatedBy: { type: String, required: true },
  },
  { _id: true },
);

const answerEvaluationSchema = new mongoose.Schema(
  {
    correctness: {
      type: String,
      enum: ['incorrect', 'partial', 'correct'],
      required: true,
    },
    // Derived deterministically in the service (correct=1, partial=0.5,
    // incorrect=0) - the LLM never outputs this number.
    score: { type: Number, required: true, min: 0, max: 1 },
    confidence: { type: Number, min: 0, max: 1, default: null },
    misconceptions: {
      type: [{ code: { type: String, default: null, maxlength: 60 }, description: String }],
      default: [],
    },
    // Generated feedback prose (kept out of learning_evidence by design).
    feedback: { type: String, required: true, maxlength: 2000 },
    model: { type: String, required: true },
    evaluatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const reassessmentAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    responseText: { type: String, required: true, maxlength: 8000 },
    evaluation: { type: answerEvaluationSchema, required: true },
    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningEvidence',
      default: null,
    },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const reassessmentSessionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // Deterministic snapshot of the topic mastery when the session started.
    masteryLevelBefore: {
      type: String,
      enum: Object.values(MASTERY_LEVELS),
      required: true,
    },
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
    },
    isPersonal: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress',
    },
    questions: { type: [reassessmentQuestionSchema], default: [] },
    answers: { type: [reassessmentAnswerSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

reassessmentSessionSchema.index({ studentId: 1, courseId: 1, createdAt: -1 });

const ReassessmentSession = mongoose.model('ReassessmentSession', reassessmentSessionSchema);

/** Maps a lean reassessment session to the public API shape (owner's view). */
export function toPublicReassessmentSession(session) {
  return {
    id: session._id.toString(),
    studentId: session.studentId.toString(),
    courseId: session.courseId.toString(),
    topicId: session.topicId.toString(),
    masteryLevelBefore: session.masteryLevelBefore,
    status: session.status,
    questions: (session.questions ?? []).map((question) => ({
      id: question._id.toString(),
      prompt: question.prompt,
      difficulty: question.difficulty,
      generatedBy: question.generatedBy,
    })),
    answers: (session.answers ?? []).map((answer) => ({
      questionId: answer.questionId.toString(),
      responseText: answer.responseText,
      evaluation: {
        correctness: answer.evaluation.correctness,
        score: answer.evaluation.score,
        confidence: answer.evaluation.confidence ?? null,
        misconceptions: answer.evaluation.misconceptions ?? [],
        feedback: answer.evaluation.feedback,
        model: answer.evaluation.model,
        evaluatedAt: answer.evaluation.evaluatedAt,
      },
      evidenceId: answer.evidenceId ? answer.evidenceId.toString() : null,
      answeredAt: answer.answeredAt,
    })),
    questionCount: (session.questions ?? []).length,
    answeredCount: (session.answers ?? []).length,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    createdAt: session.createdAt,
  };
}

export default ReassessmentSession;