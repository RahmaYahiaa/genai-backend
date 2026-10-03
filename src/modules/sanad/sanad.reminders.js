import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import User from '../auth/user.model.js';
import StudyPlan from './study-plan.model.js';
import { sendTemplated, appLink } from '../../shared/mail/templates.js';
import { SANAD_REMINDER_PROMPT } from './sanad.prompts.js';

/**
 * Plany study reminders.
 * Once a day, at the time the student picked (HH:MM in their own timezone), a student with an active study plan gets ONE email:
 *   - exam_eve : the exam is tomorrow -> last review
 *   - behind   : tasks from past days are still open -> come back, Plany re-plans
 *   - today    : today's tasks are waiting
 * Turned off from Profile > Preferences, or from the link in every email.
 */

// Older settings stored a named slot; map them to a clock time.
const LEGACY_TIMES = { morning: '09:00', noon: '14:00', evening: '20:00' };
export const DEFAULT_REMINDER_TIME = '09:00';
export const reminderTime = (value) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '') ? value : LEGACY_TIMES[value] ?? DEFAULT_REMINDER_TIME);
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const CHECK_EVERY_MS = 10 * 60 * 1000;

// ------------------------------------------------------------ time helpers
export function validTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function localNow(tz) {
  const zone = validTimezone(tz) ? tz : 'Africa/Cairo';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86_400_000);

// ------------------------------------------------------------ unsubscribe
export function unsubscribeToken(userId) {
  return crypto.createHmac('sha256', config.jwt.accessSecret).update(`sanad-reminders:${userId}`).digest('hex').slice(0, 32);
}

export function checkUnsubscribeToken(userId, token) {
  const expected = unsubscribeToken(userId);
  return typeof token === 'string' && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

// The link opens the web app, which confirms with the public API endpoint.
const unsubscribeUrl = (userId) => appLink(`/?stopReminders=${userId}.${unsubscribeToken(userId)}`);

// ------------------------------------------------------------ content
const TEXT = {
  en: {
    subject: {
      today: (n) => `Plany: ${n} study task${n === 1 ? '' : 's'} for today`,
      behind: () => "Plany: let's get your plan back on track",
      exam_eve: (c) => `Plany: your ${c} exam is tomorrow`,
    },
    title: {
      today: (name) => `Good to see you, ${name}. Here is today's plan.`,
      behind: (name) => `${name}, your plan is waiting for you.`,
      exam_eve: (name) => `${name}, tomorrow is the day.`,
    },
    body: {
      today: 'Short focused sessions every day add up. Open your plan and start with the first task.',
      behind: "You missed some tasks, and that's okay. Open your plan and Plany will spread what's left over the days you still have.",
      exam_eve: 'Today is for a light final review. Go over your weak points once more and get a good night of sleep.',
    },
    line: {
      today: 'One task at a time. You are closer than you think.',
      behind: 'Coming back is the most important step.',
      exam_eve: 'You prepared for this. Trust your work.',
    },
    row: (p) => `${p.tasks} task${p.tasks === 1 ? '' : 's'} · ${p.minutes} min · ${p.daysLeft === 0 ? 'exam today' : `${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left`}`,
    button: 'Open my study plan',
    foot: 'You get this because study reminders are on in your profile.',
    off: 'Stop reminders',
  },
  ar: {
    subject: {
      today: (n) => `بلاني: عندك ${n} ${n === 1 ? 'مهمة' : 'مهام'} مذاكرة النهارده`,
      behind: () => 'بلاني: يلا نرجّع خطتك لمسارها',
      exam_eve: (c) => `بلاني: امتحان ${c} بكرة`,
    },
    title: {
      today: (name) => `أهلاً يا ${name}، دي خطة النهارده.`,
      behind: (name) => `يا ${name}، خطتك مستنياك.`,
      exam_eve: (name) => `يا ${name}، بكرة اليوم المهم.`,
    },
    body: {
      today: 'جلسات قصيرة كل يوم بتفرق جداً. افتح خطتك وابدأ بأول مهمة.',
      behind: 'فاتتك شوية مهام، وده عادي. افتح خطتك وبلاني هيوزّع الباقي على الأيام اللي فاضلة.',
      exam_eve: 'النهارده للمراجعة الخفيفة. عدّي على نقاط ضعفك مرة كمان ونام كويس.',
    },
    line: {
      today: 'مهمة واحدة في المرة. إنت أقرب مما تتخيل.',
      behind: 'الرجوع هو أهم خطوة.',
      exam_eve: 'إنت ذاكرت لده. ثق في مجهودك.',
    },
    row: (p) => `${p.tasks} ${p.tasks === 1 ? 'مهمة' : 'مهام'} · ${p.minutes} دقيقة · ${p.daysLeft === 0 ? 'الامتحان النهارده' : `فاضل ${p.daysLeft} ${p.daysLeft === 1 ? 'يوم' : 'أيام'}`}`,
    button: 'افتح خطة المذاكرة',
    foot: 'الرسالة دي بتوصلك لأن تذكير المذاكرة شغّال في البروفايل.',
    off: 'إيقاف التذكير',
  },
};

/** What the student should hear about today, across all their active plans. */
export function summarizePlans(plans, today) {
  const rows = [];
  let kind = null;
  const rank = { today: 1, behind: 2, exam_eve: 3 };
  let examCourse = null;
  for (const plan of plans) {
    const daysLeft = daysBetween(today, plan.examDate);
    if (daysLeft < 0) continue;
    const todayTasks = (plan.days.find((d) => d.date === today)?.tasks ?? []).filter((t) => t.status === 'pending' || t.status === 'in_progress');
    const missed = plan.days.filter((d) => d.date < today).flatMap((d) => d.tasks).filter((t) => t.status === 'pending' || t.status === 'in_progress');
    let k = null;
    if (plan.examDate === addDays(today, 1)) k = 'exam_eve';
    else if (missed.length) k = 'behind';
    else if (todayTasks.length) k = 'today';
    if (!k) continue;
    const open = k === 'behind' ? [...missed, ...todayTasks] : todayTasks;
    rows.push({ planId: String(plan._id), course: plan.courseTitle || 'Course', tasks: open.length, minutes: open.reduce((n, t) => n + (t.minutes || 0), 0), daysLeft, kind: k });
    if (!kind || rank[k] > rank[kind]) {
      kind = k;
      if (k === 'exam_eve') examCourse = plan.courseTitle;
    }
  }
  return kind ? { kind, rows, examCourse } : null;
}

export function createReminderService({ llmProvider }) {
  async function encouragement(user, summary, lang) {
    try {
      const raw = await llmProvider.completeJson({
        task: 'sanad_reminder',
        system: SANAD_REMINDER_PROMPT,
        user: JSON.stringify({ kind: summary.kind, firstName: user.firstName, plans: summary.rows.map(({ course, tasks, minutes, daysLeft }) => ({ course, tasks, minutes, daysLeft })), language: lang }),
        language: lang,
      });
      const line = typeof raw?.line === 'string' ? raw.line.trim() : '';
      if (line && line.length <= 240) return line;
    } catch (error) {
      logger.debug({ err: String(error.message).slice(0, 200) }, 'Plany reminder line: AI unavailable, using the fixed line');
    }
    return TEXT[lang].line[summary.kind];
  }

  async function buildEmail(user, summary) {
    const lang = user.languagePreference === 'ar' || user.aiLanguage === 'ar' ? 'ar' : 'en';
    const L = TEXT[lang];
    const name = user.firstName || (lang === 'ar' ? 'صديقي' : 'there');
    const first = summary.rows.find((r) => r.kind === summary.kind) ?? summary.rows[0];
    const line = await encouragement(user, summary, lang);
    return {
      lang,
      subject: summary.kind === 'today' ? L.subject.today(summary.rows.reduce((n, r) => n + r.tasks, 0)) : summary.kind === 'exam_eve' ? L.subject.exam_eve(summary.examCourse) : L.subject.behind(),
      title: L.title[summary.kind](name),
      paragraphs: [L.body[summary.kind], line],
      details: summary.rows.map((r) => [r.course, L.row(r)]),
      button: { label: L.button, url: appLink(`/?studyPlan=${first.planId}`) },
      foot: L.foot,
      footLink: { label: L.off, url: unsubscribeUrl(String(user._id)) },
    };
  }

  /** Sends today's reminder to one student if there is something to say. */
  async function remindUser(user, { force = false } = {}) {
    const { date: today } = localNow(user.studyReminders?.timezone);
    const plans = await StudyPlan.find({ studentId: user._id, status: 'active' }).lean();
    const summary = summarizePlans(plans, today);
    if (!summary) return { sent: false, reason: 'nothing_today' };
    if (!force) {
      // Claim today's slot first so two servers never send the same email twice.
      const claim = await User.updateOne(
        { _id: user._id, 'studyReminders.lastSentOn': { $ne: today } },
        { $set: { 'studyReminders.lastSentOn': today } },
      );
      if (claim.modifiedCount !== 1) return { sent: false, reason: 'already_sent' };
    }
    const email = await buildEmail(user, summary);
    const status = await sendTemplated(user.email, email);
    logger.info({ userId: String(user._id), kind: summary.kind, status }, 'Plany reminder email');
    return { sent: status !== 'failed', status, kind: summary.kind };
  }

  /** One pass: every student with an active plan whose reminder time has come. */
  async function runOnce() {
    const ids = await StudyPlan.distinct('studentId', { status: 'active' });
    if (!ids.length) return 0;
    const users = await User.find({ _id: { $in: ids }, role: 'student', isActive: true, 'studyReminders.enabled': { $ne: false } })
      .select('email firstName languagePreference aiLanguage studyReminders')
      .lean();
    let sent = 0;
    for (const user of users) {
      const { date, minutes } = localNow(user.studyReminders?.timezone);
      if (user.studyReminders?.lastSentOn === date) continue;
      if (minutes < toMinutes(reminderTime(user.studyReminders?.time))) continue;
      try {
        const r = await remindUser(user);
        if (r.sent) sent += 1;
      } catch (error) {
        logger.warn({ userId: String(user._id), err: error.message }, 'Plany reminder failed for one student');
      }
    }
    return sent;
  }

  let timer = null;
  function start() {
    if (timer || config.env === 'test') return;
    const tick = () => void runOnce().catch((error) => logger.warn({ err: error.message }, 'Plany reminders pass failed'));
    setTimeout(tick, 60_000).unref();
    timer = setInterval(tick, CHECK_EVERY_MS);
    timer.unref();
    logger.info('Plany study reminders: scheduler started');
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // -------------------------------------------------- settings (profile)
  const view = (u) => ({
    enabled: u.studyReminders?.enabled !== false,
    time: reminderTime(u.studyReminders?.time),
    timezone: u.studyReminders?.timezone ?? 'Africa/Cairo',
  });

  async function getSettings(user) {
    const u = await User.findById(user.id).select('studyReminders').lean();
    return view(u ?? {});
  }

  async function updateSettings(user, { enabled, time, timezone }) {
    const set = {};
    if (typeof enabled === 'boolean') set['studyReminders.enabled'] = enabled;
    if (time) set['studyReminders.time'] = time;
    if (timezone && validTimezone(timezone)) set['studyReminders.timezone'] = timezone;
    const u = await User.findByIdAndUpdate(user.id, { $set: set }, { new: true }).select('studyReminders').lean();
    return view(u ?? {});
  }

  async function rememberTimezone(userId, timezone) {
    if (timezone && validTimezone(timezone)) await User.updateOne({ _id: userId }, { $set: { 'studyReminders.timezone': timezone } });
  }

  async function unsubscribe(userId, token) {
    if (!/^[a-f0-9]{24}$/i.test(String(userId)) || !checkUnsubscribeToken(String(userId), token)) return false;
    const r = await User.updateOne({ _id: userId }, { $set: { 'studyReminders.enabled': false } });
    return r.matchedCount === 1;
  }

  async function sendTest(user) {
    const u = await User.findById(user.id).select('email firstName languagePreference aiLanguage studyReminders').lean();
    return remindUser(u, { force: true });
  }

  return { start, stop, runOnce, remindUser, getSettings, updateSettings, rememberTimezone, unsubscribe, sendTest };
}
