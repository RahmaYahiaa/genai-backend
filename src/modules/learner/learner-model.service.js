import {
  GAP_SEVERITIES,
  MASTERY_LEVELS,
  MISCONCEPTION_STATUSES,
} from '../../config/constants.js';

const GAP_BASE_SEVERITY = {
  [MASTERY_LEVELS.NO_EVIDENCE]: GAP_SEVERITIES.MEDIUM,
  [MASTERY_LEVELS.BEGINNER]: GAP_SEVERITIES.HIGH,
  [MASTERY_LEVELS.INTERMEDIATE]: GAP_SEVERITIES.LOW,
};

const SEVERITY_RANK = {
  [GAP_SEVERITIES.LOW]: 0,
  [GAP_SEVERITIES.MEDIUM]: 1,
  [GAP_SEVERITIES.HIGH]: 2,
  [GAP_SEVERITIES.CRITICAL]: 3,
};

const MASTERY_EVIDENCE_FLOOR = 3; // below this a topic stays beginner
const MASTERED_EVIDENCE_FLOOR = 4; // mastery requires sustained evidence
const MASTERED_AVERAGE = 0.85;
const ADVANCED_AVERAGE = 0.7;
const INTERMEDIATE_AVERAGE = 0.5;

/**
 * Deterministic learner model (flow steps 8-10). ZERO machine learning by
 * design: mastery levels, gap severities, misconception aggregation, and the
 * recommended next action are pure rules over structured learning_evidence,
 * so every result is explainable and traceable to specific evidence records.
 * The model is computed on read - never stored - so it can never drift from
 * the underlying evidence.
 */
export function createLearnerModelService({
  coursesService,
  evidenceRepository,
  diagnosticRepository,
}) {
  /** Deterministic mastery ladder over a topic's evidence. */
  function deriveMasteryLevel(evidenceCount, averageScore) {
    if (evidenceCount === 0) return MASTERY_LEVELS.NO_EVIDENCE;
    if (evidenceCount < MASTERY_EVIDENCE_FLOOR) return MASTERY_LEVELS.BEGINNER;
    if (averageScore >= MASTERED_AVERAGE && evidenceCount >= MASTERED_EVIDENCE_FLOOR) {
      return MASTERY_LEVELS.MASTERED;
    }
    if (averageScore >= ADVANCED_AVERAGE) return MASTERY_LEVELS.ADVANCED;
    if (averageScore >= INTERMEDIATE_AVERAGE) return MASTERY_LEVELS.INTERMEDIATE;
    return MASTERY_LEVELS.BEGINNER;
  }

  function normalizeTopics(course) {
    return (course.topics ?? []).map((topic) => ({
      id: topic.id ?? String(topic._id),
      title: topic.title,
      prerequisiteTopicIds: (topic.prerequisiteTopicIds ?? []).map((id) => String(id)),
    }));
  }

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  async function getLearnerModel(user, courseId) {
    const course = await coursesService.ensureStudentCourseAccess(user, courseId);
    const courseDocId = course.id ?? String(course._id);
    const topics = normalizeTopics(course);

    const evidenceRows = await evidenceRepository.listByStudentCourse(user.id, courseDocId);

    // dependents map: topicId -> topics that declare it as a direct prerequisite
    const dependents = new Map(topics.map((topic) => [topic.id, []]));
    for (const topic of topics) {
      for (const prerequisiteId of topic.prerequisiteTopicIds) {
        if (dependents.has(prerequisiteId)) {
          dependents.get(prerequisiteId).push(topic.id);
        }
      }
    }

    // group evidence per topic (rows arrive newest-first)
    const evidenceByTopic = new Map(topics.map((topic) => [topic.id, []]));
    for (const row of evidenceRows) {
      const key = String(row.topicId);
      if (evidenceByTopic.has(key)) evidenceByTopic.get(key).push(row);
    }

    const mastery = topics.map((topic) => {
      const rows = evidenceByTopic.get(topic.id) ?? [];
      const evidenceCount = rows.length;
      const averageScore = evidenceCount
        ? round2(rows.reduce((sum, row) => sum + row.score, 0) / evidenceCount)
        : 0;
      const lastEvidenceAt = evidenceCount ? rows[0].createdAt : null;
      return {
        topicId: topic.id,
        title: topic.title,
        masteryLevel: deriveMasteryLevel(evidenceCount, averageScore),
        evidenceCount,
        averageScore,
        lastEvidenceAt,
      };
    });

    const masteryByTopic = new Map(mastery.map((item) => [item.topicId, item]));

    const gaps = topics
      .filter((topic) => {
        const level = masteryByTopic.get(topic.id).masteryLevel;
        return level !== MASTERY_LEVELS.ADVANCED && level !== MASTERY_LEVELS.MASTERED;
      })
      .map((topic) => {
        const stat = masteryByTopic.get(topic.id);
        const dependentTopicIds = dependents.get(topic.id) ?? [];
        // Escalate one severity step when the topic unlocks other topics.
        const baseSeverity = GAP_BASE_SEVERITY[stat.masteryLevel] ?? GAP_SEVERITIES.LOW;
        const severity =
          dependentTopicIds.length >= 1
            ? Object.values(GAP_SEVERITIES)[Math.min(SEVERITY_RANK[baseSeverity] + 1, 3)]
            : baseSeverity;
        return {
          topicId: topic.id,
          title: topic.title,
          masteryLevel: stat.masteryLevel,
          evidenceCount: stat.evidenceCount,
          averageScore: stat.averageScore,
          severity,
          dependentTopicIds,
          // Traceability: the exact evidence records behind this gap.
          evidenceIds: (evidenceByTopic.get(topic.id) ?? [])
            .slice(0, 5)
            .map((row) => row._id.toString()),
        };
      })
      .sort((a, b) => {
        const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (bySeverity !== 0) return bySeverity;
        const byDependents = b.dependentTopicIds.length - a.dependentTopicIds.length;
        if (byDependents !== 0) return byDependents;
        return a.averageScore - b.averageScore;
      });

    // Misconception aggregation from coded evidence only.
    const misconceptionMap = new Map();
    for (const row of evidenceRows) {
      for (const code of row.misconceptionCodes ?? []) {
        if (!misconceptionMap.has(code)) {
          misconceptionMap.set(code, { code, occurrences: 0, topicIds: new Set() });
        }
        const entry = misconceptionMap.get(code);
        entry.occurrences += 1;
        entry.topicIds.add(String(row.topicId));
      }
    }
    const misconceptions = [...misconceptionMap.values()]
      .map((entry) => ({
        code: entry.code,
        occurrences: entry.occurrences,
        topicIds: [...entry.topicIds],
        status: MISCONCEPTION_STATUSES.SUSPECTED,
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const assessedTopicsCount = mastery.filter((item) => item.evidenceCount > 0).length;
    const overview = {
      topicsCount: topics.length,
      assessedTopicsCount,
      masteredTopicsCount: mastery.filter(
        (item) => item.masteryLevel === MASTERY_LEVELS.MASTERED,
      ).length,
      gapsCount: gaps.length,
      evidenceCount: evidenceRows.length,
      overallAverageScore: evidenceRows.length
        ? round2(evidenceRows.reduce((sum, row) => sum + row.score, 0) / evidenceRows.length)
        : 0,
    };

    // Recommended next action: fixed priority rules, all deterministic.
    let recommendedNextAction;
    if (topics.length === 0) {
      recommendedNextAction = { action: 'unavailable', reason: 'course_has_no_topics' };
    } else {
      const inProgress = await diagnosticRepository.findLatestByStatus(
        user.id,
        courseDocId,
        'in_progress',
      );
      if (inProgress) {
        recommendedNextAction = {
          action: 'continue_diagnostic',
          diagnosticId: inProgress._id.toString(),
          remainingQuestions:
            (inProgress.questions ?? []).length - (inProgress.answers ?? []).length,
        };
      } else if (evidenceRows.length === 0) {
        recommendedNextAction = { action: 'start_diagnostic', reason: 'no_evidence_yet' };
      } else if (gaps.length > 0) {
        const topGap = gaps[0];
        recommendedNextAction =
          topGap.dependentTopicIds.length >= 1
            ? {
                action: 'review_topic',
                topicId: topGap.topicId,
                reason: `severity_${topGap.severity}_unlocks_${topGap.dependentTopicIds.length}_topics`,
              }
            : {
                action: 'practice_topic',
                topicId: topGap.topicId,
                reason: `severity_${topGap.severity}`,
              };
      } else {
        recommendedNextAction = {
          action: 'reassess',
          reason: 'all_topics_advanced_or_mastered',
        };
      }
    }

    return {
      courseId: courseDocId,
      mastery,
      gaps,
      misconceptions,
      overview,
      recommendedNextAction,
      generatedAt: new Date().toISOString(),
    };
  }

  return { getLearnerModel };
}