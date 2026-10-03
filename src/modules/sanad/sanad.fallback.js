// Last-resort logic for Plany, used ONLY when no AI is reachable (LeRna and the
// backend AI are both down). Simple, predictable rules so the agent keeps
// working; the AI versions in sanad.service.js are always tried first.

export const TASK_MINUTES = { check: 10, learn: 20, practice: 15, quiz: 15, review: 10, reassess: 15 };
const LEVEL_WEIGHT = { no_evidence: 3, beginner: 3, intermediate: 2, advanced: 1, mastered: 0.3 };

const T = {
  en: {
    check: (t) => `Quick check: ${t}`, learn: (t) => `Learn: ${t}`, practice: (t) => `Practice: ${t}`,
    quiz: (t) => `Quiz: ${t}`, review: (t) => `Review: ${t}`, reassess: (t) => `Progress check: ${t}`,
    whyCheck: 'We have no answers from you on this yet, so we start by finding your level.',
    whyLearn: 'Your results show this topic needs the most work.',
    whyPractice: 'Practice right after learning makes it stick.',
    whyReview: 'A short review a few days later keeps it from fading.',
    whyReassess: 'New questions on the same topic show if the gap is really closed.',
    whyQuiz: 'A mixed quiz on your weak points before the exam.',
    day: (n) => `Day ${n}`, last: 'Final review', focus: (list) => `Focus on ${list}.`,
    summary: (weak, n) => `You have ${n} study day${n === 1 ? '' : 's'}. ${weak ? `We start with ${weak}, where your results are lowest, then practice and review.` : 'We start by checking your level on each topic, then practice the weak ones.'}`,
    short: ' Time is short, so the plan covers the topics with the biggest effect first.',
    reasonWeak: (s) => `Your average here is ${s}%.`, reasonUnknown: 'No answers yet on this topic.', reasonUnlocks: ' Other topics depend on it.',
    adaptGood: (t) => `Great result on ${t}. We keep the plan going.`,
    adaptMid: (t) => `You are getting there on ${t}. We added a short extra practice.`,
    adaptLowPre: (t, p) => `${t} was hard. It builds on ${p}, so we go over ${p} first, then come back.`,
    adaptLow: (t) => `${t} was hard. We added a lesson with worked examples, then practice.`,
    adaptMoveOn: (t) => `${t} needs more time. We scheduled one more focused session later and moved on so you cover everything.`,
    adaptMissed: 'You missed some tasks. We moved the important ones forward and kept each day within your time.',
    reply: {
      plan: 'Tell me the course and the exam date, and I will build your plan.',
      ready: (c) => `Got it. I will build a plan for ${c}.`,
      missing: { course: 'Which course is the exam for?', examDate: 'When is the exam?', dailyMinutes: 'How much time can you study each day?' },
      today: (task) => (task ? `Your next step: ${task}.` : 'You have no plan yet. Tell me about your next exam and I will build one.'),
      progress: 'Here is your progress. Open My Progress for the full picture.',
      explain: 'The AI Tutor is the best place for that. It explains from your course files.',
      other: 'I am Plany, your study coach. Tell me about your next exam, or ask what to study today.',
    },
  },
  ar: {
    check: (t) => `اختبار سريع: ${t}`, learn: (t) => `اتعلّم: ${t}`, practice: (t) => `تدريب: ${t}`,
    quiz: (t) => `كويز: ${t}`, review: (t) => `مراجعة: ${t}`, reassess: (t) => `قياس تقدّم: ${t}`,
    whyCheck: 'لسه مفيش إجابات منك في الموضوع ده، فهنبدأ نعرف مستواك.',
    whyLearn: 'نتايجك بتقول إن الموضوع ده محتاج شغل أكتر.',
    whyPractice: 'التدريب بعد الشرح على طول بيثبّت المعلومة.',
    whyReview: 'مراجعة قصيرة بعد كام يوم بتمنع إنك تنسى.',
    whyReassess: 'أسئلة جديدة على نفس الموضوع بتأكد إن الفجوة اتقفلت فعلاً.',
    whyQuiz: 'كويز على نقط ضعفك قبل الامتحان.',
    day: (n) => `اليوم ${n}`, last: 'مراجعة أخيرة', focus: (list) => `التركيز على ${list}.`,
    summary: (weak, n) => `قدامك ${n} يوم مذاكرة. ${weak ? `هنبدأ بـ ${weak} لأن نتايجك فيها الأقل، وبعدين تدريب ومراجعة.` : 'هنبدأ نعرف مستواك في كل موضوع، وبعدين نتدرّب على الضعيف.'}`,
    short: ' الوقت قليل، فالخطة بتغطي المواضيع الأكثر تأثيراً الأول.',
    reasonWeak: (s) => `متوسطك هنا ${s}%.`, reasonUnknown: 'لسه مفيش إجابات في الموضوع ده.', reasonUnlocks: ' ومواضيع تانية معتمدة عليه.',
    adaptGood: (t) => `نتيجة ممتازة في ${t}. هنكمّل الخطة.`,
    adaptMid: (t) => `قربت في ${t}. ضفنالك تدريب قصير زيادة.`,
    adaptLowPre: (t, p) => `${t} كان صعب. هو معتمد على ${p}، فهنراجع ${p} الأول ونرجع له.`,
    adaptLow: (t) => `${t} كان صعب. ضفنا شرح بأمثلة محلولة وبعده تدريب.`,
    adaptMoveOn: (t) => `${t} محتاج وقت أكتر. حطينا جلسة مركّزة كمان بعدين وكمّلنا عشان تغطي كل حاجة.`,
    adaptMissed: 'فاتتك شوية مهام. نقلنا المهم لقدّام وخلينا كل يوم في حدود وقتك.',
    reply: {
      plan: 'قولّي المادة وميعاد الامتحان وأنا أعملك الخطة.',
      ready: (c) => `تمام. هعملك خطة لـ ${c}.`,
      missing: { course: 'الامتحان في أنهي مادة؟', examDate: 'الامتحان إمتى؟', dailyMinutes: 'تقدر تذاكر قد إيه كل يوم؟' },
      today: (task) => (task ? `خطوتك الجاية: ${task}.` : 'لسه معندكش خطة. قولّي على امتحانك الجاي وأنا أعملها.'),
      progress: 'ده تقدّمك. افتح "تقدّمي" عشان تشوف الصورة كاملة.',
      explain: 'المعلم الذكي أحسن مكان لده، بيشرح من ملفات المادة.',
      other: 'أنا بلاني، مدرّب المذاكرة بتاعك. قولّي على امتحانك الجاي، أو اسألني أذاكر إيه النهارده.',
    },
  },
};
const tr = (lang) => (lang === 'ar' ? T.ar : T.en);

const pct = (v) => Math.round((v ?? 0) * 100);

/** Order topics: weakest first, but a prerequisite always before what depends on it. */
function prioritize(topics) {
  const score = (t) => (LEVEL_WEIGHT[t.level] ?? 2) + (t.unlocks?.length ? 1 : 0) + (1 - (t.averageScore ?? 0));
  const byId = new Map(topics.map((t) => [t.id, t]));
  const sorted = [...topics].sort((a, b) => score(b) - score(a));
  const out = [];
  const seen = new Set();
  const visit = (t, depth = 0) => {
    if (seen.has(t.id) || depth > 10) return;
    for (const p of t.prerequisiteTopicIds ?? []) {
      const pre = byId.get(p);
      if (pre && (LEVEL_WEIGHT[pre.level] ?? 2) >= 2) visit(pre, depth + 1);
    }
    seen.add(t.id);
    out.push(t);
  };
  sorted.forEach((t) => visit(t));
  return out;
}

function task(type, topic, lang, why) {
  return { type, topicId: topic.id, topicTitle: topic.title, minutes: TASK_MINUTES[type], title: tr(lang)[type](topic.title), why };
}

/** Rule-based plan: same output shape as the AI plan. */
export function rulePlan({ topics, dates, dailyMinutes, language }) {
  const L = tr(language);
  const ordered = prioritize(topics);
  const queue = []; // { task, earliestDay }
  const studyDays = dates.length >= 3 ? dates.length - 1 : dates.length; // keep the last day light
  ordered.forEach((topic) => {
    const weight = LEVEL_WEIGHT[topic.level] ?? 2;
    if (topic.level === 'no_evidence') queue.push(task('check', topic, language, L.whyCheck));
    if (weight >= 2) {
      queue.push(task('learn', topic, language, L.whyLearn));
      queue.push(task('practice', topic, language, L.whyPractice));
      queue.push({ ...task('review', topic, language, L.whyReview), gap: 2 });
    } else {
      queue.push(task('review', topic, language, L.whyReview));
    }
  });

  const days = dates.map((date, i) => ({ date, title: L.day(i + 1), focus: '', tasks: [], used: 0 }));
  const placedDay = new Map(); // topicId -> last day index used
  let dropped = 0;
  for (const item of queue) {
    const { gap, ...t } = item;
    const after = gap ? (placedDay.get(t.topicId) ?? 0) + gap : placedDay.get(t.topicId) ?? 0;
    let placed = false;
    for (let d = Math.min(after, studyDays - 1); d < studyDays; d += 1) {
      if (days[d].used + t.minutes <= dailyMinutes || days[d].tasks.length === 0) {
        days[d].tasks.push(t);
        days[d].used += t.minutes;
        placedDay.set(t.topicId, d);
        placed = true;
        break;
      }
    }
    if (!placed) dropped += 1;
  }

  // Before the exam: progress check on worked topics, then a light final day.
  if (dates.length >= 3) {
    const worked = ordered.filter((t) => (LEVEL_WEIGHT[t.level] ?? 2) >= 2).slice(0, 3);
    const pre = days[dates.length - 2];
    worked.forEach((t) => {
      if (pre.used + TASK_MINUTES.reassess <= dailyMinutes) {
        pre.tasks.push(task('reassess', t, language, L.whyReassess));
        pre.used += TASK_MINUTES.reassess;
      }
    });
    const last = days[dates.length - 1];
    last.title = L.last;
    const weakest = ordered[0];
    if (weakest) last.tasks.push(task('quiz', weakest, language, L.whyQuiz));
  }

  for (const day of days) {
    const names = [...new Set(day.tasks.map((t) => t.topicTitle))];
    if (names.length && day.title.match(/^(Day|اليوم) /)) day.title = names.slice(0, 2).join(language === 'ar' ? ' و' : ' & ');
    day.focus = names.length ? L.focus(names.slice(0, 3).join(language === 'ar' ? '، ' : ', ')) : '';
    delete day.used;
  }

  const weak = ordered.filter((t) => (LEVEL_WEIGHT[t.level] ?? 2) >= 2 && t.level !== 'no_evidence').slice(0, 2).map((t) => t.title);
  const focusTopics = ordered.filter((t) => (LEVEL_WEIGHT[t.level] ?? 2) >= 2).slice(0, 4).map((t) => ({
    topicId: t.id,
    reason: (t.level === 'no_evidence' ? L.reasonUnknown : L.reasonWeak(pct(t.averageScore))) + (t.unlocks?.length ? L.reasonUnlocks : ''),
  }));
  return {
    summary: L.summary(weak.join(language === 'ar' ? ' و' : ' and '), dates.length) + (dropped ? L.short : ''),
    focusTopics,
    days: days.filter((d) => d.tasks.length),
  };
}

/** Rule-based change of the remaining days after an event. */
export function ruleAdapt({ event, topics, remainingDays, dailyMinutes, language }) {
  const L = tr(language);
  const days = remainingDays.map((d) => ({ ...d, tasks: d.tasks.map((t) => ({ ...t })) }));
  const topic = topics.find((t) => t.id === event.topicId);
  const insert = (dayIndex, t) => {
    const day = days[Math.min(dayIndex, days.length - 1)];
    if (!day) return;
    const used = day.tasks.reduce((s, x) => s + x.minutes, 0);
    if (used + t.minutes > dailyMinutes) {
      // make room: drop the last review of that day
      const idx = day.tasks.map((x) => x.type).lastIndexOf('review');
      if (idx >= 0) day.tasks.splice(idx, 1);
    }
    day.tasks.unshift(t);
  };

  if (event.type === 'missed_days') {
    // Squeeze: keep each day within the time, important tasks first.
    const rank = { reassess: 0, learn: 1, check: 2, practice: 3, quiz: 4, review: 5 };
    const all = days.flatMap((d) => d.tasks).sort((a, b) => rank[a.type] - rank[b.type]);
    days.forEach((d) => (d.tasks = []));
    const order = [...days.keys()];
    for (const t of all) {
      const target = t.type === 'reassess' ? [...order].reverse().slice(1, 2).concat(order) : order;
      for (const i of target) {
        const used = days[i]?.tasks.reduce((s, x) => s + x.minutes, 0) ?? Infinity;
        if (used + t.minutes <= dailyMinutes) { days[i].tasks.push(t); break; }
      }
    }
    return { decision: 'reschedule', message: L.adaptMissed, days };
  }

  if (!topic) return { decision: 'continue', message: L.adaptGood(event.topicTitle ?? ''), days };
  const score = event.type === 'confused' ? 0.5 : event.score ?? 0;
  if (score >= 0.7) return { decision: 'continue', message: L.adaptGood(topic.title), days };
  if ((event.attemptsOnTopic ?? 1) >= 3) {
    insert(Math.max(1, days.length - 2), task('practice', topic, language, L.whyPractice));
    return { decision: 'move_on', message: L.adaptMoveOn(topic.title), days };
  }
  if (score >= 0.4) {
    insert(0, task('practice', topic, language, L.whyPractice));
    return { decision: 'reinforce', message: L.adaptMid(topic.title), days };
  }
  const weakPre = (topic.prerequisiteTopicIds ?? []).map((id) => topics.find((t) => t.id === id)).find((p) => p && ['no_evidence', 'beginner'].includes(p.level));
  if (weakPre) {
    insert(0, task('practice', topic, language, L.whyPractice));
    insert(0, task('learn', weakPre, language, L.whyLearn));
    return { decision: 'prerequisite', message: L.adaptLowPre(topic.title, weakPre.title), days };
  }
  insert(0, task('practice', topic, language, L.whyPractice));
  insert(0, task('learn', topic, language, L.whyLearn));
  return { decision: 'reteach', message: L.adaptLow(topic.title), days };
}

/** Rule-based reading of a chat message. */
export function ruleUnderstand({ message, today, courses, currentCourseId, activePlans, language }) {
  const L = tr(language);
  const text = (message ?? '').toLowerCase();
  const has = (re) => re.test(text);
  let intent = 'other';
  if (has(/exam|test|quiz|midterm|final|plan|prepare|where (do i|to) start|امتحان|إمتحان|اختبار|ميدترم|فاينال|خطة|خطه|اذاكر|أذاكر|مذاكرة|ابدأ منين|أبدأ منين/)) intent = 'make_plan';
  if (has(/today|now|next|continue|النهارده|النهاردة|دلوقتي|الجاي|أكمل|اكمل/) && activePlans.length) intent = 'today';
  if (has(/progress|how am i|level|my score|تقدم|تقدّم|مستوايا|مستواي|عامل ازاي/)) intent = 'progress';
  if (intent === 'other' && has(/explain|what is|how does|اشرح|يعني ايه|يعني إيه|ازاي/)) intent = 'explain';

  const course = courses.find((c) => (c.code && text.includes(c.code.toLowerCase())) || text.includes(c.title.toLowerCase())) ??
    courses.find((c) => c.id === currentCourseId) ?? (courses.length === 1 ? courses[0] : null);

  let examDate = null;
  const base = new Date(`${today}T00:00:00Z`);
  const add = (n) => new Date(base.getTime() + n * 86400000).toISOString().slice(0, 10);
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  const nDays = text.match(/(\d+)\s*(day|days|يوم|أيام|ايام)/);
  const nWeeks = text.match(/(\d+)\s*(week|weeks|أسابيع|اسابيع)/);
  if (iso) examDate = iso[1];
  else if (nDays) examDate = add(Number(nDays[1]));
  else if (nWeeks) examDate = add(7 * Number(nWeeks[1]));
  else if (has(/tomorrow|بكرة|بكره/)) examDate = add(1);
  else if (has(/two weeks|أسبوعين|اسبوعين/)) examDate = add(14);
  else if (has(/a week|next week|أسبوع|اسبوع/)) examDate = add(7);

  let dailyMinutes = null;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(hour|hours|ساعة|ساعات)/);
  const mins = text.match(/(\d+)\s*(min|minutes|دقيقة|دقايق|دقائق)/);
  if (hours) dailyMinutes = Math.round(Number(hours[1]) * 60);
  else if (mins) dailyMinutes = Number(mins[1]);
  else if (has(/an hour|one hour|ساعة/)) dailyMinutes = 60;
  else if (has(/half an hour|نص ساعة|نصف ساعة/)) dailyMinutes = 30;

  const missing = [];
  if (!course) missing.push('course');
  if (!examDate) missing.push('examDate');
  if (!dailyMinutes) missing.push('dailyMinutes');

  let reply = L.reply.other;
  if (intent === 'make_plan') reply = missing.length ? missing.map((m) => L.reply.missing[m]).join(' ') : L.reply.ready(course.title);
  if (intent === 'today') reply = L.reply.today(activePlans[0]?.nextTask ?? null);
  if (intent === 'progress') reply = L.reply.progress;
  if (intent === 'explain') reply = L.reply.explain;
  return { intent, courseId: course?.id ?? null, examDate, dailyMinutes, missing, reply };
}

/** Rule-based lesson: the course text itself, organised. */
export function ruleLesson({ topic, courseMaterial }) {
  const text = String(courseMaterial ?? '').replace(/^#+\s*/gm, '').replace(/[*_`>|]/g, '').replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?؟])\s+/).filter((s) => s.length > 30);
  return {
    explanation: sentences.slice(0, 6).join(' ') || topic,
    example: null,
    keyPoints: sentences.slice(6, 10),
    flashcards: [],
    exercises: [],
  };
}
