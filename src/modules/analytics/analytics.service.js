import { ForbiddenError } from '../../shared/errors/index.js';
import {
  ROLES,
  SUBMISSION_STATUS,
  AI_CONFIDENCE,
  ASSIGNMENT_STATUS,
  MATERIAL_STATUSES,
} from '../../config/constants.js';
import { toPublicAnalyticsSnapshot } from './analytics.model.js';

const PENDING_REVIEW_STATUSES = [
  SUBMISSION_STATUS.SUBMITTED,
  SUBMISSION_STATUS.GRADING,
  SUBMISSION_STATUS.GRADED,
];

function emptyTotals() {
  return {
    finalizedCount: 0,
    pendingReviewCount: 0,
    fastTrackCount: 0,
    avgCoursePercentage: null,
  };
}

export function createAnalyticsService({
  coursesService,
  courseRepository,
  assignmentRepository,
  assignmentQuestionRepository,
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  aiEvaluationRepository,
  materialRepository,
  evidenceRepository,
  analyticsRepository,
  domainEvents,
}) {
  /**
   * Full precompute for one course. Reads authoritative collections and
   * writes a single snapshot document; API reads NEVER aggregate on request.
   */
  async function recomputeCourse(courseId) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return null;
    }
    const topics = course.topics ?? [];

    const assignments = await assignmentRepository.listByCourse({
      courseId: course._id,
      status: null,
      skip: 0,
      limit: 0,
    });
    const activeAssignments = assignments.items.filter(
      (assignment) => assignment.status !== ASSIGNMENT_STATUS.DRAFT,
    );

    const questionCountByTopic = new Map();
    const maxTotalByAssignment = new Map();
    for (const assignment of activeAssignments) {
      const questions = await assignmentQuestionRepository.listByAssignment(assignment._id);
      maxTotalByAssignment.set(
        String(assignment._id),
        questions.reduce((sum, question) => sum + question.maxScore, 0),
      );
      for (const question of questions) {
        const key = String(question.topicId);
        questionCountByTopic.set(key, (questionCountByTopic.get(key) ?? 0) + 1);
      }
    }

    let finalizedCount = 0;
    let pendingReviewCount = 0;
    let fastTrackCount = 0;
    const finalizedPercentages = [];
    const assignmentCounts = { totalCount: activeAssignments.length, openCount: 0, closedCount: 0 };
    for (const assignment of activeAssignments) {
      if (assignment.status === ASSIGNMENT_STATUS.OPEN) assignmentCounts.openCount += 1;
      if (assignment.status === ASSIGNMENT_STATUS.CLOSED) assignmentCounts.closedCount += 1;
      const { items } = await submissionRepository.listByAssignment({
        assignmentId: assignment._id,
        status: null,
        skip: 0,
        limit: 0,
      });
      const maxTotal = maxTotalByAssignment.get(String(assignment._id)) ?? 0;
      for (const submission of items) {
        if (submission.status === SUBMISSION_STATUS.FINALIZED) {
          finalizedCount += 1;
          if (maxTotal > 0 && submission.finalScoreTotal != null) {
            finalizedPercentages.push(
              Math.min(100, (submission.finalScoreTotal / maxTotal) * 100),
            );
          }
        } else if (PENDING_REVIEW_STATUSES.includes(submission.status)) {
          pendingReviewCount += 1;
          if (submission.status === SUBMISSION_STATUS.GRADED) {
            const attempt = await submissionAttemptRepository.findLatest(submission._id);
            const answers = attempt
              ? await submissionAnswerRepository.listByAttempt(attempt._id)
              : [];
            const evaluations = await aiEvaluationRepository.listBySubmission(submission._id);
            const evaluationByAnswer = new Map(
              evaluations.map((evaluation) => [String(evaluation.answerId), evaluation]),
            );
            const allHigh =
              answers.length > 0 &&
              answers.every(
                (answer) =>
                  evaluationByAnswer.get(String(answer._id))?.confidence ===
                  AI_CONFIDENCE.HIGH,
              );
            if (allHigh) {
              fastTrackCount += 1;
            }
          }
        }
      }
    }

    const evidenceRows = await evidenceRepository.listByCourseAndType(
      course._id,
      'assignment',
    );
    const statsByTopic = new Map();
    for (const row of evidenceRows) {
      const key = String(row.topicId);
      const entry = statsByTopic.get(key) ?? {
        evidenceIds: [],
        students: new Set(),
        scoreSum: 0,
      };
      entry.evidenceIds.push(row._id.toString());
      entry.students.add(row.studentId.toString());
      entry.scoreSum += row.score;
      statsByTopic.set(key, entry);
    }
    const topicStats = topics.map((topic) => {
      const stats = statsByTopic.get(String(topic._id));
      const evidenceCount = stats?.evidenceIds.length ?? 0;
      return {
        topicId: String(topic._id),
        title: topic.title,
        evidenceCount,
        studentsGradedCount: stats?.students.size ?? 0,
        avgScorePercentage:
          evidenceCount > 0 ? Math.round((stats.scoreSum / evidenceCount) * 100) : null,
        evidenceIds: stats?.evidenceIds ?? [],
      };
    });

    const coverage = topics.map((topic) => {
      const assignmentQuestionCount = questionCountByTopic.get(String(topic._id)) ?? 0;
      return {
        topicId: String(topic._id),
        title: topic.title,
        assignmentQuestionCount,
        isGap: assignmentQuestionCount === 0,
      };
    });

    const materials = await materialRepository.listByCourse(course._id, { skip: 0, limit: 0 });

    const payload = {
      totals: {
        finalizedCount,
        pendingReviewCount,
        fastTrackCount,
        avgCoursePercentage:
          finalizedPercentages.length > 0
            ? Math.round(
                finalizedPercentages.reduce((sum, value) => sum + value, 0) /
                  finalizedPercentages.length,
              )
            : null,
        assignments: assignmentCounts,
        materials: {
          totalCount: materials.total,
          readyCount: materials.items.filter((material) => material.status === MATERIAL_STATUSES.READY).length,
        },
      },
      topics: topicStats,
      coverage,
    };
    const document = await analyticsRepository.upsertByCourse(course._id, {
      computedAt: new Date(),
      payload,
    });
    return document;
  }

  async function getCourseAnalytics(user, courseId) {
    await coursesService.ensureInstructorCourseAccess(user, courseId);
    const snapshot = await analyticsRepository.findByCourse(courseId);
    if (!snapshot) {
      domainEvents.emit('AnalyticsSnapshotMissing', { courseId });
      return { computedAt: null, totals: emptyTotals(), topics: [] };
    }
    return toPublicAnalyticsSnapshot(snapshot);
  }

  async function getCoverageGaps(user, courseId) {
    await coursesService.ensureInstructorCourseAccess(user, courseId);
    const snapshot = await analyticsRepository.findByCourse(courseId);
    if (!snapshot) {
      domainEvents.emit('AnalyticsSnapshotMissing', { courseId });
      return { computedAt: null, items: [], totalTopics: null, coveredTopics: null };
    }
    const coverage = snapshot.payload?.coverage ?? [];
    const gaps = coverage
      .filter((entry) => entry.isGap)
      .map((entry) => ({
        topicId: entry.topicId,
        title: entry.title,
        assignmentQuestionCount: entry.assignmentQuestionCount,
      }));
    return {
      computedAt: snapshot.computedAt,
      items: gaps,
      totalTopics: coverage.length,
      coveredTopics: coverage.length - gaps.length,
    };
  }

  async function getInstructorHome(user) {
    if (user.role === ROLES.STUDENT) {
      throw new ForbiddenError('Only instructors can access the instructor home');
    }
    const { items } = await courseRepository.listStaffedCourses({
      userId: user.id,
      skip: 0,
      limit: 0,
    });
    const courses = [];
    for (const course of items) {
      const snapshot = await analyticsRepository.findByCourse(course._id);
      const totals = snapshot?.payload?.totals;
      if (!snapshot) {
        domainEvents.emit('AnalyticsSnapshotMissing', { courseId: course._id.toString() });
      }
      courses.push({
        courseId: course._id.toString(),
        title: course.title,
        code: course.code,
        computedAt: snapshot?.computedAt ?? null,
        finalizedCount: totals?.finalizedCount ?? 0,
        pendingReviewCount: totals?.pendingReviewCount ?? 0,
        fastTrackCount: totals?.fastTrackCount ?? 0,
      });
    }
    courses.sort(
      (a, b) =>
        b.pendingReviewCount - a.pendingReviewCount || a.title.localeCompare(b.title),
    );
    return { courses };
  }

  return { recomputeCourse, getCourseAnalytics, getCoverageGaps, getInstructorHome };
}