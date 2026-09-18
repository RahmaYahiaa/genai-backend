import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { AI_CONFIDENCE } from '../../config/constants.js';
import { engineClient } from './engine.client.js';
import { findMapping, upsertMapping } from './engine-mapping.model.js';
import * as materialRepository from '../knowledge/material.repository.js';
import { createFileStorage } from '../knowledge/file-storage.js';

const fileStorage = createFileStorage();
const PREVIEW_STUDENT_KEY = 'preview';

const TYPE_MAP = {
  multiple_choice: 'mcq',
  multiple_select: 'multi_select',
  true_false: 'true_false',
  essay: 'essay',
  short_answer: 'short_answer',
  long_answer: 'long_answer',
  problem_solving: 'problem',
};
const OBJECTIVE_ENGINE_TYPES = new Set(['mcq', 'multi_select', 'true_false']);
const CORRECTNESS_MAP = { correct: 'CORRECT', partial: 'PARTIAL', incorrect: 'INCORRECT' };
const CONFIDENCE_MAP = {
  high: AI_CONFIDENCE.HIGH,
  medium: AI_CONFIDENCE.MEDIUM,
  low: AI_CONFIDENCE.LOW,
};

const DEFERRED_FEEDBACK =
  'Grading was deferred to mandatory manual review: no trusted source (model answer, rubric, or course material) was available to evaluate this answer.';

function engineType(question) {
  return TYPE_MAP[question.questionType] ?? 'essay';
}

function enginePoints(maxScore) {
  return Math.min(Math.max(Number(maxScore) || 1, 0.5), 100);
}

function buildRubric(rubricText, points) {
  const lines = String(rubricText ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => line.slice(0, 200));
  if (lines.length === 0) return [];
  const share = Math.floor((points / lines.length) * 100) / 100;
  return lines.map((criterion, index) => ({
    criterion,
    max_points:
      index === lines.length - 1
        ? Math.round((points - share * (lines.length - 1)) * 100) / 100
        : share,
  }));
}

function correctIndexes(question) {
  const options = question.options ?? [];
  const correctIds = new Set(question.correctOptionIds ?? []);
  return options.map((option, index) => (correctIds.has(option.id) ? index : -1)).filter((i) => i >= 0);
}

export function toEngineQuestion(question, topicTitle) {
  const type = engineType(question);
  const points = enginePoints(question.maxScore);
  const options = (question.options ?? []).map((option) => String(option.text).slice(0, 500));
  const engineQuestion = {
    type,
    text: question.questionText,
    options,
    correct_answer: {},
    model_answer: question.modelAnswer ?? '',
    points,
    topic: topicTitle ?? '',
    rubric: buildRubric(question.rubricText, points),
  };
  const indexes = correctIndexes(question);
  if (type === 'mcq') {
    engineQuestion.correct_answer = { index: indexes[0] ?? 0 };
  } else if (type === 'multi_select') {
    engineQuestion.correct_answer = { indices: indexes };
  } else if (type === 'true_false') {
    const optionsList = question.options ?? [];
    const correctOption = optionsList.find((option) => (question.correctOptionIds ?? []).includes(option.id));
    engineQuestion.correct_answer = { value: String(correctOption?.text ?? 'true').trim().toLowerCase() };
    engineQuestion.options = [];
  }
  return engineQuestion;
}

export function toEngineResponse(question, answer) {
  const type = engineType(question);
  const options = question.options ?? [];
  const selected = new Set(answer?.selectedOptionIds ?? []);
  const indexes = options.map((option, index) => (selected.has(option.id) ? index : -1)).filter((i) => i >= 0);
  if (type === 'mcq') return { index: indexes[0] ?? -1 };
  if (type === 'multi_select') return { indices: indexes.length > 0 ? indexes : [-1] };
  if (type === 'true_false') {
    const chosen = options.find((option) => selected.has(option.id));
    return { value: String(chosen?.text ?? '').trim().toLowerCase() };
  }
  return { text: answer?.answerText ?? '' };
}

function topicTitleFor(course, question) {
  const topics = course?.topics ?? [];
  const topic = topics.find((item) => String(item._id ?? item.id) === String(question.topicId));
  return topic?.title ?? '';
}

async function ensureCourseMirror(course) {
  const localId = String(course._id ?? course.id);
  const existing = await findMapping('course', localId);
  if (existing) return existing.engineId;
  const created = await engineClient.createCourse({
    title: String(course.title ?? 'Course').slice(0, 200),
    subject: course.code ?? '',
    code: course.code ?? '',
    description: '',
  });
  const engineId = created.course_id ?? created.id;
  await upsertMapping('course', localId, engineId);
  return engineId;
}

async function syncMaterials(courseId, engineCourseId) {
  const { items } = await materialRepository.listByCourse(courseId, { skip: 0, limit: 200 });
  for (const material of items) {
    if (!material.storageKey) continue;
    const localId = String(material._id);
    const existing = await findMapping('material', localId);
    if (existing) continue;
    try {
      const absolutePath = await fileStorage.requireMaterialFile(material.storageKey);
      const buffer = await fs.readFile(absolutePath);
      const filename = material.originalName ?? `${material.title ?? 'material'}.txt`;
      const result = await engineClient.uploadMaterial(engineCourseId, filename, buffer, material.mimeType);
      await upsertMapping('material', localId, String(result.material_id));
    } catch (error) {
      logger.warn(`assessment engine: material sync failed for ${localId}: ${error?.message}`);
    }
  }
}

function questionsHash(questions) {
  const payload = questions.map((question) => ({
    t: question.questionType,
    x: question.questionText,
    m: question.maxScore,
    o: (question.options ?? []).map((option) => option.text),
    c: question.correctOptionIds ?? [],
    a: question.modelAnswer ?? '',
    r: question.rubricText ?? '',
    p: String(question.topicId),
  }));
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function ensureAssessmentMirror(course, assignment, questions) {
  const localId = String(assignment._id);
  const hash = questionsHash(questions);
  const existing = await findMapping('assessment', localId);
  if (existing && existing.meta?.hash === hash && existing.meta?.engineQuestionIds?.length === questions.length) {
    return { engineAssessmentId: existing.engineId, engineQuestionIds: existing.meta.engineQuestionIds };
  }
  const engineCourseId = await ensureCourseMirror(course);
  await syncMaterials(course._id ?? course.id, engineCourseId);
  const engineQuestions = questions.map((question) => toEngineQuestion(question, topicTitleFor(course, question)));
  const created = await engineClient.createAssessment(engineCourseId, {
    kind: 'assignment',
    title: String(assignment.title ?? 'Assignment').slice(0, 200),
    attempt_limit: 100000,
    release_mode: 'immediate',
    questions: engineQuestions,
  });
  await engineClient.publishAssessment(created.assessment_id);
  const full = await engineClient.getAssessment(created.assessment_id);
  const engineQuestionIds = (full.questions ?? []).map((question) => question.question_id ?? question.id);
  if (engineQuestionIds.length !== questions.length) {
    throw new Error('assessment engine returned an unexpected question list');
  }
  await upsertMapping('assessment', localId, String(created.assessment_id), { hash, engineQuestionIds });
  return { engineAssessmentId: String(created.assessment_id), engineQuestionIds };
}

export function mapEvaluation(row, question) {
  const points = enginePoints(question.maxScore);
  const scale = Number(question.maxScore) / points;
  const evidence = row.evidence ?? [];
  const noSource =
    Boolean(row.needs_review) &&
    evidence.length === 0 &&
    !question.modelAnswer &&
    !question.rubricText;
  const score =
    noSource || row.score === null || row.score === undefined
      ? null
      : Math.round(row.score * scale * 100) / 100;
  return {
    engineEvaluationId: row.evaluation_id != null ? String(row.evaluation_id) : null,
    score,
    correctness: noSource ? null : CORRECTNESS_MAP[row.correct_status] ?? 'PARTIAL',
    confidence: noSource ? AI_CONFIDENCE.INSUFFICIENT_EVIDENCE : CONFIDENCE_MAP[row.confidence] ?? AI_CONFIDENCE.MEDIUM,
    feedbackText: noSource ? DEFERRED_FEEDBACK : String(row.feedback ?? ''),
    misconceptions: (row.weaknesses ?? []).slice(0, 20).map((weakness) => ({
      code: 'EVIDENCE-WEAKNESS',
      description: String(weakness).slice(0, 500),
    })),
    rubricBreakdown: row.rubric_results?.length ? row.rubric_results : null,
    sourcesUsed: {
      question: true,
      model_answer: Boolean(question.modelAnswer),
      rubric: Boolean(question.rubricText),
      retrievedChunks: evidence.length,
      chunkIds: evidence
        .map((item) => `${item.material ?? 'material'}#${item.page ?? item.slide ?? item.section ?? ''}`.slice(0, 64))
        .filter((value, index, list) => list.indexOf(value) === index),
      engine: 'assessment-engine',
      needsReview: Boolean(row.needs_review),
      reviewReason: row.review_reason ?? '',
    },
    modelVersion: 'evaluation-engine-v1',
    promptVersion: 'engine-v1',
  };
}

export function matchRowsToQuestions(rows, questions) {
  const byText = new Map();
  for (const row of rows) {
    const key = String(row.question_text ?? '');
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(row);
  }
  const result = new Map();
  questions.forEach((question, index) => {
    const queue = byText.get(String(question.questionText));
    let row = queue?.shift() ?? null;
    if (!row) row = rows[index] ?? null;
    if (row) result.set(String(question._id), mapEvaluation(row, question));
  });
  return result;
}

async function submitAndCollect(engineAssessmentId, engineQuestionIds, questions, answersByKey, studentKey) {
  const engineAnswers = questions.map((question, index) => ({
    question_id: engineQuestionIds[index],
    response: toEngineResponse(question, answersByKey.get(String(question._id)) ?? null),
  }));
  const submitted = await engineClient.submit(engineAssessmentId, studentKey, engineAnswers);
  const view = await engineClient.submissionView(submitted.submission_id);
  return view.per_question ?? [];
}

export function createAssessmentEngineService({ isEnabled = () => config.assessmentEngine.enabled } = {}) {
  async function gradeAttempt({ course, assignment, questions, answers, studentId }) {
    const { engineAssessmentId, engineQuestionIds } = await ensureAssessmentMirror(course, assignment, questions);
    const answersByKey = new Map(answers.map((answer) => [String(answer.questionId), answer]));
    const rows = await submitAndCollect(
      engineAssessmentId,
      engineQuestionIds,
      questions,
      answersByKey,
      String(studentId),
    );
    return matchRowsToQuestions(rows, questions);
  }

  async function previewQuestion({ course, question, answerText }) {
    const engineCourseId = await ensureCourseMirror(course);
    await syncMaterials(course._id ?? course.id, engineCourseId);
    const engineQuestion = toEngineQuestion(question, topicTitleFor(course, question));
    if (OBJECTIVE_ENGINE_TYPES.has(engineQuestion.type)) return null;
    const created = await engineClient.createAssessment(engineCourseId, {
      kind: 'quiz',
      title: `Preview - ${String(question.questionText).slice(0, 60)}`,
      attempt_limit: 100000,
      release_mode: 'immediate',
      questions: [engineQuestion],
    });
    await engineClient.publishAssessment(created.assessment_id);
    const full = await engineClient.getAssessment(created.assessment_id);
    const engineQuestionIds = (full.questions ?? []).map((item) => item.question_id ?? item.id);
    const submitted = await engineClient.submit(created.assessment_id, PREVIEW_STUDENT_KEY, [
      { question_id: engineQuestionIds[0], response: { text: answerText } },
    ]);
    const view = await engineClient.submissionView(submitted.submission_id);
    const row = (view.per_question ?? [])[0];
    return row ? mapEvaluation(row, question) : null;
  }

  return { isEnabled, gradeAttempt, previewQuestion };
}

export const assessmentEngine = createAssessmentEngineService();