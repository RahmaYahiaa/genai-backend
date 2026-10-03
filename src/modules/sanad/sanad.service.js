import mongoose from 'mongoose';
import { z } from 'zod';
import { logger } from '../../config/logger.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors/index.js';
import StudyPlan, { TASK_TYPES } from './study-plan.model.js';
import { SANAD_UNDERSTAND_PROMPT, SANAD_PLAN_PROMPT, SANAD_ADAPT_PROMPT, SANAD_LESSON_PROMPT } from './sanad.prompts.js';
import { rulePlan, ruleAdapt, ruleUnderstand, ruleLesson, TASK_MINUTES } from './sanad.fallback.js';

const MAX_DAYS = 30;
const DAY_MS = 86400000;

// ---------------------------------------------------------------- AI output shapes
const aiTask = z.object({
  type: z.string(),
  topicId: z.string(),
  minutes: z.coerce.number().optional(),
  title: z.string().optional(),
  why: z.string().optional(),
});
const aiDay = z.object({ date: z.string(), title: z.string().optional(), focus: z.string().optional(), tasks: z.array(aiTask) });
const planOut = z.object({
  summary: z.string().min(1),
  focusTopics: z.array(z.object({ topicId: z.string(), reason: z.string().optional() })).optional().default([]),
  days: z.array(aiDay).min(1),
});
const adaptOut = z.object({ decision: z.string().optional(), message: z.string().min(1), days: z.array(aiDay) });
const understandOut = z.object({
  intent: z.enum(['make_plan', 'today', 'progress', 'explain', 'other']).catch('other'),
  courseId: z.string().nullable().optional(),
  examDate: z.string().nullable().optional(),
  dailyMinutes: z.coerce.number().nullable().optional(),
  missing: z.array(z.string()).optional().default([]),
  reply: z.string().min(1),
});
const lessonOut = z.object({
  explanation: z.string().min(40),
  example: z.object({ problem: z.string(), solution: z.string() }).nullable().optional(),
  keyPoints: z.array(z.string()).optional().default([]),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })).optional().default([]),
  exercises: z.array(z.object({ question: z.string(), answer: z.string() })).optional().default([]),
});

// ---------------------------------------------------------------- helpers
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / DAY_MS);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

function studyDates(today, examDate) {
  const gap = daysBetween(today, examDate);
  const count = Math.max(1, Math.min(MAX_DAYS, gap));
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

export function createSanadService({ coursesService, learnerModelService, topicDetectionService, practiceService, reassessmentService, practiceSessionModel, reassessmentSessionModel, llmProvider }) {
  /** Run one AI task: LeRna first, then the backend AI (inside llmProvider). Returns null when no AI answered well. */
  async function ai(task, system, input, language, schema) {
    // Two tries: a busy or cut-off answer often works on the second, shorter try.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const prompt = attempt === 1 ? system : `${system}\nIMPORTANT: keep every text very short (under 10 words) so the JSON is complete.`;
        const raw = await llmProvider.completeJson({ task, system: prompt, user: JSON.stringify(input), language });
        const parsed = schema.safeParse(raw);
        if (!parsed.success) throw new Error(`${task}: output did not match the expected shape`);
        return { data: parsed.data, source: llmProvider.lastSource === 'lerna' ? 'lerna' : 'ai' };
      } catch (error) {
        logger.warn({ task, attempt, err: String(error.message).slice(0, 300) }, 'Plany AI step failed');
        if (attempt === 1) await new Promise((r) => setTimeout(r, 2500));
      }
    }
    logger.warn({ task }, 'Plany: no AI available, using the rule-based fallback');
    return null;
  }

  // Profile AI language first (same rule as the tutor), then the language the
  // student is writing / using the site in.
  const languageOf = (user, hint = null, text = '') =>
    user.aiLanguage || (/[\u0600-\u06FF]/.test(text) ? 'ar' : null) || hint || user.languagePreference || 'en';

  async function studentCourses(user) {
    const { items } = await coursesService.listCourses(user, { page: 1, limit: 100 });
    return items.map((c) => ({ id: String(c.id ?? c._id), title: c.title, code: c.code ?? null }));
  }

  /** Diagnose: the student's level per topic from their real answers. */
  async function diagnose(user, courseId, topicIds = null) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const model = await learnerModelService.getLearnerModel(user, courseId);
    const unlocks = new Map();
    for (const t of course.topics ?? []) {
      for (const p of t.prerequisiteTopicIds ?? []) {
        const k = String(p);
        unlocks.set(k, [...(unlocks.get(k) ?? []), String(t._id ?? t.id)]);
      }
    }
    let topics = (course.topics ?? []).map((t) => {
      const id = String(t._id ?? t.id);
      const m = model.mastery.find((x) => x.topicId === id);
      return {
        id,
        title: t.title,
        level: m?.masteryLevel ?? 'no_evidence',
        averageScore: m?.averageScore ?? 0,
        answers: m?.evidenceCount ?? 0,
        prerequisiteTopicIds: (t.prerequisiteTopicIds ?? []).map(String),
        unlocks: unlocks.get(id) ?? [],
      };
    });
    if (topicIds?.length) topics = topics.filter((t) => topicIds.includes(t.id));
    return { course, topics, commonMistakes: model.misconceptions.slice(0, 8).map(({ code, occurrences, topicIds: ids }) => ({ code, occurrences, topicIds: ids })) };
  }

  /** Keep only valid AI days/tasks: known dates, known topics, known types, within the daily time. */
  function cleanDays(rawDays, { dates, topics, dailyMinutes }) {
    const byId = new Map(topics.map((t) => [t.id, t]));
    const allowed = new Set(dates);
    const seen = new Set();
    const days = [];
    for (const d of rawDays) {
      if (!allowed.has(d.date) || seen.has(d.date)) continue;
      seen.add(d.date);
      let used = 0;
      const tasks = [];
      for (const t of d.tasks) {
        const topic = byId.get(t.topicId);
        if (!topic || !TASK_TYPES.includes(t.type)) continue;
        const minutes = Math.max(5, Math.min(Number(t.minutes) || TASK_MINUTES[t.type], dailyMinutes, 240));
        if (used + minutes > dailyMinutes * 1.15 && tasks.length) continue;
        used += minutes;
        tasks.push({ type: t.type, topicId: topic.id, topicTitle: topic.title, minutes, title: (t.title || `${t.type}: ${topic.title}`).slice(0, 200), why: (t.why ?? '').slice(0, 500) });
      }
      if (tasks.length) days.push({ date: d.date, title: (d.title ?? '').slice(0, 120), focus: (d.focus ?? '').slice(0, 300), tasks });
    }
    return days.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Safety net: dates the AI left empty get short reviews of topics already planned. */
  function fillEmptyDays(days, dates, topics, dailyMinutes, language) {
    const planned = [];
    const out = [...days];
    for (const date of dates) {
      const day = out.find((d) => d.date === date);
      if (day) {
        day.tasks.forEach((t) => !planned.includes(t.topicId) && planned.push(t.topicId));
        continue;
      }
      if (!planned.length) continue;
      const pick = planned.slice(0, Math.max(1, Math.floor(dailyMinutes / 15)));
      const ar = language === 'ar';
      out.push({
        date,
        title: ar ? 'مراجعة' : 'Review day',
        focus: ar ? 'مراجعة قصيرة للي ذاكرته عشان ما يتنسيش.' : 'Short reviews of what you studied, so it sticks.',
        tasks: pick.map((id) => {
          const topic = topics.find((t) => t.id === id);
          return { type: 'review', topicId: id, topicTitle: topic.title, minutes: Math.min(15, dailyMinutes), title: ar ? `مراجعة: ${topic.title}` : `Review: ${topic.title}`, why: ar ? 'المراجعة بعد كام يوم بتثبّت المعلومة.' : 'Reviewing a few days later makes it stick.' };
        }),
      });
      planned.push(planned.shift());
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  async function ownPlan(user, planId) {
    if (!mongoose.isValidObjectId(planId)) throw new NotFoundError('Plan not found');
    const plan = await StudyPlan.findOne({ _id: planId, studentId: user.id });
    if (!plan) throw new NotFoundError('Plan not found');
    return plan;
  }

  function findTask(plan, taskId) {
    for (const day of plan.days) {
      const task = day.tasks.id(taskId);
      if (task) return { day, task };
    }
    throw new NotFoundError('Task not found in this plan');
  }

  /** Current level of the plan topics, to show the gap closing. */
  async function withProgress(user, plan) {
    const json = plan.toJSON();
    try {
      const model = await learnerModelService.getLearnerModel(user, String(plan.courseId));
      const ids = new Set(plan.days.flatMap((d) => d.tasks.map((t) => String(t.topicId))));
      json.progress = model.mastery
        .filter((m) => ids.has(m.topicId))
        .map((m) => {
          const start = plan.focusTopics.find((f) => String(f.topicId) === m.topicId);
          return { topicId: m.topicId, title: m.title, level: m.masteryLevel, score: m.averageScore, levelAtStart: start?.levelAtStart ?? null, scoreAtStart: start?.scoreAtStart ?? null, focus: Boolean(start) };
        });
    } catch {
      json.progress = [];
    }
    const all = plan.days.flatMap((d) => d.tasks);
    json.stats = { total: all.length, done: all.filter((t) => t.status === 'done').length, minutes: all.reduce((s, t) => s + t.minutes, 0) };
    return json;
  }

  // ---------------------------------------------------------------- plans
  async function createPlan(user, { courseId, examDate, dailyMinutes, topicIds, goal, today, language: hint }) {
    const day0 = today || todayIso();
    if (daysBetween(day0, examDate) < 0) throw new ValidationError('The exam date has already passed');
    const { course, topics, commonMistakes } = await diagnose(user, courseId, topicIds);
    if (!topics.length) throw new ValidationError('This course has no topics yet. Add course files first so Plany can plan.');
    const dates = studyDates(day0, examDate);
    const language = languageOf(user, hint, goal ?? '');

    const input = { today: day0, examDate, dates, daysCount: dates.length, dailyMinutes, goal: goal ?? '', course: course.title, topics, commonMistakes, language };
    const result = await ai('sanad_plan', SANAD_PLAN_PROMPT, input, language, planOut);
    let plan = null;
    let source = 'rules';
    if (result) {
      const days = cleanDays(result.data.days, { dates, topics, dailyMinutes });
      if (days.length) {
        plan = { ...result.data, days: fillEmptyDays(days, dates, topics, dailyMinutes, language) };
        source = result.source;
      }
    }
    if (!plan) plan = rulePlan({ topics, dates, dailyMinutes, language });

    // One active plan per course.
    await StudyPlan.updateMany({ studentId: user.id, courseId: toId(courseId), status: 'active' }, { $set: { status: 'archived' } });
    const focusTopics = (plan.focusTopics ?? [])
      .map((f) => topics.find((t) => t.id === f.topicId) && { topic: topics.find((t) => t.id === f.topicId), reason: f.reason })
      .filter(Boolean)
      .map(({ topic, reason }) => ({ topicId: toId(topic.id), title: topic.title, reason: reason ?? '', levelAtStart: topic.level, scoreAtStart: topic.averageScore }));

    const doc = await StudyPlan.create({
      studentId: user.id,
      courseId: toId(courseId),
      courseTitle: course.title,
      goal: goal ?? '',
      examDate,
      dailyMinutes,
      language,
      source,
      summary: plan.summary,
      focusTopics,
      days: plan.days.map((d) => ({ ...d, tasks: d.tasks.map((t) => ({ ...t, topicId: toId(t.topicId) })) })),
      notes: [{ kind: 'created', decision: 'plan', message: plan.summary, source }],
    });
    return withProgress(user, doc);
  }

  async function listPlans(user, { courseId, status }) {
    const filter = { studentId: user.id };
    if (courseId) filter.courseId = toId(courseId);
    filter.status = status ?? { $in: ['active', 'completed'] };
    const plans = await StudyPlan.find(filter).sort({ updatedAt: -1 }).limit(50);
    return plans.map((p) => {
      const json = p.toJSON();
      const all = p.days.flatMap((d) => d.tasks);
      const next = p.days.flatMap((d) => d.tasks.map((t) => ({ t, date: d.date }))).find(({ t }) => t.status !== 'done' && t.status !== 'skipped');
      return {
        id: json.id, courseId: String(p.courseId), courseTitle: p.courseTitle, examDate: p.examDate, dailyMinutes: p.dailyMinutes,
        status: p.status, source: p.source, summary: p.summary, createdAt: p.createdAt, updatedAt: p.updatedAt,
        stats: { total: all.length, done: all.filter((t) => t.status === 'done').length },
        nextTask: next ? { id: String(next.t._id), title: next.t.title, type: next.t.type, date: next.date, minutes: next.t.minutes } : null,
      };
    });
  }

  async function getPlan(user, planId) {
    return withProgress(user, await ownPlan(user, planId));
  }

  async function archivePlan(user, planId) {
    const plan = await ownPlan(user, planId);
    plan.status = 'archived';
    await plan.save();
    return { id: String(plan._id), status: plan.status };
  }

  // ---------------------------------------------------------------- tasks
  async function lessonFor(user, plan, task) {
    const language = plan.language || languageOf(user);
    let context;
    try {
      const focus = await topicDetectionService.resolveFocus(String(plan.courseId), user.id, { topicId: String(task.topicId), focus: null, materialId: null });
      context = Array.isArray(focus.context) ? focus.context.map((c) => c.text ?? c).join('\n\n') : String(focus.context ?? '');
    } catch {
      context = '';
    }
    const { topics } = await diagnose(user, String(plan.courseId));
    const topic = topics.find((t) => t.id === String(task.topicId));
    const mistakes = plan.days.flatMap((d) => d.tasks).filter((t) => String(t.topicId) === String(task.topicId) && t.result?.score != null && t.result.score < 0.7).length
      ? await recentMistakes(user, plan, task.topicId)
      : [];
    const input = { course: plan.courseTitle, topic: task.topicTitle, level: topic?.level ?? 'no_evidence', averageScore: topic?.averageScore ?? 0, mistakes, courseMaterial: context.slice(0, 9000), language };
    const result = await ai('sanad_lesson', SANAD_LESSON_PROMPT, input, language, lessonOut);
    if (result) return { ...result.data, source: result.source };
    return { ...ruleLesson({ topic: task.topicTitle, courseMaterial: context }), source: 'rules' };
  }

  async function recentMistakes(user, plan, topicId) {
    const sessions = await practiceSessionModel.find({ studentId: user.id, courseId: plan.courseId, topicId }).sort({ createdAt: -1 }).limit(3).lean();
    return sessions.flatMap((s) => (s.answers ?? []).filter((a) => (a.evaluation?.score ?? 1) < 0.7).map((a) => a.evaluation?.feedback)).filter(Boolean).slice(0, 5);
  }

  const QUESTIONS = { check: 2, practice: 3, quiz: 4, review: 2, reassess: 3 };

  async function startTask(user, planId, taskId) {
    const plan = await ownPlan(user, planId);
    if (plan.status !== 'active') throw new ForbiddenError('This plan is no longer active');
    const { task } = findTask(plan, taskId);
    const courseId = String(plan.courseId);

    if (task.type === 'learn') {
      if (!task.lesson?.explanation) task.lesson = await lessonFor(user, plan, task);
    } else if (!task.refId || task.status === 'done') {
      const questionsCount = QUESTIONS[task.type] ?? 3;
      let started = null;
      if (task.type === 'reassess') {
        try {
          started = { kind: 'reassessment', session: await reassessmentService.startSession(user, courseId, { topicId: String(task.topicId), questionsCount }) };
        } catch (error) {
          logger.info({ err: error.message }, 'Plany: progress check not possible yet, using practice');
        }
      }
      if (!started) started = { kind: 'practice', session: await practiceService.startSession(user, courseId, { topicId: String(task.topicId), questionsCount }) };
      task.refKind = started.kind;
      task.refId = toId(started.session.id ?? started.session._id);
      task.result = null;
    }
    if (task.status !== 'done') task.status = 'in_progress';
    await plan.save();
    return { plan: await withProgress(user, plan), task: plan.toJSON().days.flatMap((d) => d.tasks).find((t) => t.id === String(task._id)) };
  }

  async function scoreOf(user, task) {
    const Model = task.refKind === 'reassessment' ? reassessmentSessionModel : practiceSessionModel;
    const session = await Model.findOne({ _id: task.refId, studentId: user.id }).lean();
    if (!session) return null;
    const answers = session.answers ?? [];
    const total = (session.questions ?? []).length;
    const score = answers.length ? answers.reduce((s, a) => s + (a.evaluation?.score ?? 0), 0) / answers.length : 0;
    const mistakes = answers.filter((a) => (a.evaluation?.score ?? 1) < 0.7).map((a) => a.evaluation?.feedback).filter(Boolean).slice(0, 5);
    return { score: Math.round(score * 100) / 100, answered: answers.length, total, mistakes };
  }

  /** Adapt: AI decides how the rest of the plan changes; rules only if no AI. */
  async function adapt(user, plan, event, today) {
    const day0 = today || todayIso();
    const remaining = plan.days.filter((d) => d.date >= day0);
    const kept = remaining.map((d) => ({
      date: d.date, title: d.title, focus: d.focus,
      tasks: d.tasks.filter((t) => t.status === 'pending').map((t) => ({ type: t.type, topicId: String(t.topicId), topicTitle: t.topicTitle, minutes: t.minutes, title: t.title, why: t.why })),
    }));
    // Days ahead must exist even if the plan had none left (up to the exam).
    const dates = studyDates(day0, plan.examDate);
    for (const date of dates) if (!kept.some((d) => d.date === date)) kept.push({ date, title: '', focus: '', tasks: [] });
    kept.sort((a, b) => a.date.localeCompare(b.date));
    if (event.type === 'missed_days') {
      // Carry unfinished past tasks into the remaining days.
      const missed = plan.days.filter((d) => d.date < day0).flatMap((d) => d.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'));
      kept[0].tasks.unshift(...missed.map((t) => ({ type: t.type, topicId: String(t.topicId), topicTitle: t.topicTitle, minutes: t.minutes, title: t.title, why: t.why })));
      missed.forEach((t) => (t.status = 'skipped'));
    }

    const { topics } = await diagnose(user, String(plan.courseId));
    const language = plan.language;
    const input = { today: day0, examDate: plan.examDate, dailyMinutes: plan.dailyMinutes, event, topics, remainingDays: kept, language };
    const result = await ai('sanad_adapt', SANAD_ADAPT_PROMPT, input, language, adaptOut);
    let change = null;
    let source = 'rules';
    if (result) {
      const days = cleanDays(result.data.days, { dates, topics, dailyMinutes: plan.dailyMinutes });
      if (days.length || !kept.some((d) => d.tasks.length)) {
        change = { ...result.data, days };
        source = result.source;
      }
    }
    if (!change) change = ruleAdapt({ event, topics, remainingDays: kept, dailyMinutes: plan.dailyMinutes, language });

    // Replace the pending tasks of the remaining days; keep finished / running ones.
    const byDate = new Map(change.days.map((d) => [d.date, d]));
    for (const day of plan.days.filter((d) => d.date >= day0)) {
      const next = byDate.get(day.date);
      day.tasks = day.tasks.filter((t) => t.status !== 'pending');
      if (next) {
        const busy = new Set(day.tasks.map((t) => `${t.type}:${t.topicId}`));
        day.tasks.push(...next.tasks.filter((t) => !busy.has(`${t.type}:${t.topicId}`)).map((t) => ({ ...t, topicId: toId(t.topicId) })));
        if (next.title) day.title = next.title;
        if (next.focus) day.focus = next.focus;
        byDate.delete(day.date);
      }
    }
    for (const next of byDate.values()) {
      plan.days.push({ ...next, tasks: next.tasks.map((t) => ({ ...t, topicId: toId(t.topicId) })) });
    }
    plan.days.sort((a, b) => a.date.localeCompare(b.date));
    plan.days = plan.days.filter((d) => d.tasks.length);
    const note = { kind: event.type, decision: change.decision ?? 'continue', message: change.message, source };
    plan.notes.push(note);
    return note;
  }

  async function completeTask(user, planId, taskId, { feeling, today }) {
    const plan = await ownPlan(user, planId);
    const { task } = findTask(plan, taskId);
    if (task.status === 'done') return { plan: await withProgress(user, plan), note: null };

    let event = null;
    if (task.type === 'learn') {
      task.result = { feeling: feeling ?? 'clear', at: new Date() };
      if (feeling === 'confused') event = { type: 'confused', taskType: 'learn', topicId: String(task.topicId), topicTitle: task.topicTitle };
    } else {
      if (!task.refId) throw new ValidationError('Start this task first');
      const s = await scoreOf(user, task);
      if (!s || s.answered === 0) throw new ValidationError('Answer at least one question first');
      task.result = { score: s.score, answered: s.answered, total: s.total, at: new Date() };
      const attemptsOnTopic = plan.days.flatMap((d) => d.tasks).filter((t) => String(t.topicId) === String(task.topicId) && t.result?.score != null && t.result.score < 0.7).length;
      event = { type: 'task_result', taskType: task.type, topicId: String(task.topicId), topicTitle: task.topicTitle, score: s.score, attemptsOnTopic, mistakes: s.mistakes };
    }
    task.status = 'done';
    const note = event ? await adapt(user, plan, event, today) : null;
    if (plan.days.every((d) => d.tasks.every((t) => t.status === 'done' || t.status === 'skipped'))) plan.status = 'completed';
    await plan.save();
    return { plan: await withProgress(user, plan), note };
  }

  async function skipTask(user, planId, taskId) {
    const plan = await ownPlan(user, planId);
    const { task } = findTask(plan, taskId);
    if (task.status !== 'done') task.status = 'skipped';
    await plan.save();
    return withProgress(user, plan);
  }

  async function replan(user, planId, { today }) {
    const plan = await ownPlan(user, planId);
    if (plan.status !== 'active') throw new ForbiddenError('This plan is no longer active');
    const note = await adapt(user, plan, { type: 'missed_days' }, today);
    await plan.save();
    return { plan: await withProgress(user, plan), note };
  }

  // ---------------------------------------------------------------- chat
  async function chat(user, { message, history, courseId, today, language: hint }) {
    const day0 = today || todayIso();
    const language = languageOf(user, hint, message);
    const courses = await studentCourses(user);
    const plans = await listPlans(user, { status: 'active' });
    const activePlans = plans.map((p) => ({ id: p.id, courseId: p.courseId, title: p.courseTitle, examDate: p.examDate, nextTask: p.nextTask?.title ?? null }));
    const input = { message, history: (history ?? []).slice(-6), today: day0, courses, currentCourseId: courseId ?? null, activePlans, language };

    const result = await ai('sanad_understand', SANAD_UNDERSTAND_PROMPT, input, language, understandOut);
    const read = result?.data ?? ruleUnderstand({ message, today: day0, courses, currentCourseId: courseId, activePlans, language });
    const source = result?.source ?? 'rules';
    const course = courses.find((c) => c.id === read.courseId) ?? null;
    let examDate = read.examDate && /^\d{4}-\d{2}-\d{2}$/.test(read.examDate) ? read.examDate : null;
    if (examDate && daysBetween(day0, examDate) < 0) examDate = null;

    let action = null;
    if (read.intent === 'make_plan') {
      action = {
        type: 'propose_plan',
        courseId: course?.id ?? null,
        courseTitle: course?.title ?? null,
        examDate,
        dailyMinutes: read.dailyMinutes ? Math.max(15, Math.min(1440, Math.round(read.dailyMinutes))) : null,
        existingPlanId: course ? plans.find((p) => p.courseId === course.id)?.id ?? null : null,
      };
    } else if (read.intent === 'today') {
      const p = (course && plans.find((x) => x.courseId === course.id)) || plans[0];
      if (p) action = { type: 'open_plan', planId: p.id, courseId: p.courseId, task: p.nextTask };
    } else if (read.intent === 'progress') {
      action = { type: 'open', screen: 'mastery', courseId: course?.id ?? null };
    } else if (read.intent === 'explain') {
      action = { type: 'open', screen: 'tutor', courseId: course?.id ?? null };
    }
    return { reply: read.reply, intent: read.intent, action, source, courses };
  }

  async function overview(user) {
    const courses = await studentCourses(user);
    const plans = await listPlans(user, {});
    return { courses, plans };
  }

  return { createPlan, listPlans, getPlan, archivePlan, startTask, completeTask, skipTask, replan, chat, overview };
}
