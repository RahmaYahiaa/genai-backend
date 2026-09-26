/**
 * Local learning state built from the platform's own evidence (diagnostics,
 * practice, reassessments -> learner model). Same response shape as the AI
 * engine's /students/:id/learning so the student UI works unchanged.
 *
 * Used when the AI engine is unreachable, and when it has no mastery data yet:
 * the engine only learns from its own assessments/reviews, so evidence the
 * student produced here would otherwise never show up on "My Progress".
 */
const score = (value) => (typeof value === 'number' ? (value > 1 ? value / 100 : value) : 0);

export async function buildLocalLearningState(user) {
  // Lazy imports keep the LeRna module free of import cycles.
  const { coursesService } = await import('../courses/index.js');
  const { learnerModelService } = await import('../learner/index.js');

  const { items: courses } = await coursesService.listCourses(user, { q: undefined, page: 1, limit: 20 });
  const models = await Promise.all(
    (courses ?? []).map((course) =>
      learnerModelService.getLearnerModel(user, course.id).then(
        (model) => ({ course, model }),
        () => null,
      ),
    ),
  );

  const conceptMastery = {};
  const misconceptions = [];
  const topics = [];
  for (const entry of models.filter(Boolean)) {
    for (const row of entry.model.mastery ?? []) {
      if ((row.evidenceCount ?? 0) === 0) continue;
      const value = Math.round(score(row.averageScore) * 100) / 100;
      conceptMastery[row.title] = value;
      topics.push({ title: row.title, value, course: entry.course });
    }
    for (const item of entry.model.misconceptions ?? []) misconceptions.push(item.code);
  }

  topics.sort((a, b) => a.value - b.value);
  const weak = topics.filter((t) => t.value < 0.5).map((t) => t.title);
  const developing = topics.filter((t) => t.value >= 0.5 && t.value < 0.7).map((t) => t.title);
  const strong = topics.filter((t) => t.value >= 0.7).map((t) => t.title);

  let nextAction = null;
  if (topics.length > 0) {
    if (weak.length > 0) {
      nextAction = {
        action: misconceptions.length > 0 ? 'resolve_misconceptions' : 'build_foundation',
        reason: `Your answers show gaps in ${weak.slice(0, 3).join(', ')}.`,
        target_concepts: weak.slice(0, 3),
        priority: 'high',
      };
    } else if (developing.length > 0) {
      nextAction = {
        action: 'reinforce',
        reason: `You're close on ${developing.slice(0, 3).join(', ')} — a little more practice will lock it in.`,
        target_concepts: developing.slice(0, 3),
        priority: 'medium',
      };
    } else {
      nextAction = {
        action: 'progress',
        reason: 'You are doing well on every topic you have been checked on.',
        target_concepts: strong.slice(0, 3),
        priority: 'low',
      };
    }
  }

  const studyPlan = [...weak, ...developing].slice(0, 5).map((title) => {
    const value = conceptMastery[title];
    return {
      title,
      reason: `Current level ${Math.round(value * 100)}%.`,
      priority: value < 0.5 ? 'high' : 'medium',
      recommended_actions:
        value < 0.5
          ? ['Ask the AI Tutor to explain it step by step', 'Do a short practice on this topic']
          : ['Do a practice round on this topic', 'Measure your progress afterwards'],
    };
  });

  return {
    profile: {
      concept_mastery: conceptMastery,
      weak_concepts: weak,
      strengths: strong,
      misconceptions: [...new Set(misconceptions)],
    },
    next_action: nextAction,
    study_plan: studyPlan,
    review_queue: [],
    source: 'platform_evidence',
  };
}
