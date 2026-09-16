import {
  AI_CONFIDENCE,
  SUBMISSION_STATUS,
  FINAL_GRADE_DECISIONS,
  AUDIT_ACTIONS,
} from '../../config/constants.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import { toPublicSubmission } from '../submissions/submission.model.js';
import { toPublicFinalGrade } from './final-grade.model.js';

const REVIEWABLE_STATUSES = [
  SUBMISSION_STATUS.SUBMITTED,
  SUBMISSION_STATUS.GRADING,
  SUBMISSION_STATUS.GRADED,
  SUBMISSION_STATUS.RESUBMISSION_REQUESTED,
  SUBMISSION_STATUS.FINALIZED,
];

const FAST_TRACK_STATUSES = [SUBMISSION_STATUS.GRADED, SUBMISSION_STATUS.FINALIZED];

function notEligibleError(detail) {
  return new AppError({
    statusCode: 400,
    code: 'NOT_FAST_TRACK_ELIGIBLE',
    message: 'One or more submissions are not in the fast-track bucket',
    details: detail,
  });
}

export function createReviewService({
  coursesService,
  auditService,
  authService,
  assignmentRepository,
  assignmentQuestionRepository,
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  aiEvaluationRepository,
  finalGradeRepository,
}) {
  async function getAssignmentForReview(user, assignmentId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    await coursesService.ensureInstructorCourseAccess(user, assignment.courseId.toString());
    return assignment;
  }

  async function buildReviewRows(assignment, query) {
    const submissions = await submissionRepository.listByAssignment({
      assignmentId: assignment._id,
      status: null,
      skip: 0,
      limit: 0,
    });
    const reviewable = submissions.items
      .filter((submission) => REVIEWABLE_STATUSES.includes(submission.status))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const questions = await assignmentQuestionRepository.listByAssignment(assignment._id);
    const maxTotalScore = questions.reduce((sum, question) => sum + question.maxScore, 0);

    let rows = [];
    for (const submission of reviewable) {
      const attempt = await submissionAttemptRepository.findLatest(submission._id);
      const answers = attempt ? await submissionAnswerRepository.listByAttempt(attempt._id) : [];
      const evaluations = await aiEvaluationRepository.listBySubmission(submission._id);
      const evaluationByAnswer = new Map(
        evaluations.map((evaluation) => [String(evaluation.answerId), evaluation]),
      );
      const answerRows = answers.map((answer) => {
        const question = questions.find((q) => String(q._id) === String(answer.questionId));
        const evaluation = evaluationByAnswer.get(String(answer._id)) ?? null;
        return {
          answerId: answer._id.toString(),
          questionId: answer.questionId.toString(),
          aiScore: evaluation?.score ?? null,
          maxScore: question?.maxScore ?? null,
          confidence: evaluation?.confidence ?? null,
          feedbackText: evaluation?.feedbackText ?? null,
          misconceptions: evaluation?.misconceptions ?? [],
        };
      });
      const fastTrackEligible =
        FAST_TRACK_STATUSES.includes(submission.status) &&
        answerRows.length > 0 &&
        answerRows.every((row) => row.confidence === AI_CONFIDENCE.HIGH);
      rows.push({
        submission: toPublicSubmission(submission),
        studentId: submission.studentId.toString(),
        decided: submission.status === SUBMISSION_STATUS.FINALIZED,
        fastTrackEligible,
        aiTotalScore: answerRows.reduce(
          (sum, row) => sum + (row.aiScore === null ? 0 : row.aiScore),
          0,
        ),
        maxTotalScore,
        answers: answerRows,
      });
    }

    const profiles = await authService.getProfilesByIds(
      Array.from(new Set(rows.map((row) => row.studentId))),
    );
    const nameById = new Map(
      profiles.map((profile) => [
        profile.id,
        `${profile.firstName} ${profile.lastName}`.trim(),
      ]),
    );
    rows = rows.map((row) => ({
      ...row,
      studentName: nameById.get(row.studentId) ?? 'Unknown student',
    }));

    if (query.studentName) {
      const needle = query.studentName.toLowerCase();
      rows = rows.filter((row) => row.studentName.toLowerCase().includes(needle));
    }
    if (query.confidence) {
      rows = rows.filter((row) =>
        row.answers.some((answer) => answer.confidence === query.confidence),
      );
    }
    if (query.approved !== undefined) {
      rows = rows.filter((row) => row.decided === query.approved);
    }
    return rows;
  }

  async function getReview(user, assignmentId, query) {
    const assignment = await getAssignmentForReview(user, assignmentId);
    const rows = await buildReviewRows(assignment, query);
    const fastTrack = rows.filter((row) => row.fastTrackEligible);
    const needsReview = rows.filter((row) => !row.fastTrackEligible);
    const start = (query.page - 1) * query.limit;
    const paged = [...fastTrack, ...needsReview].slice(start, start + query.limit);
    return {
      fastTrack,
      needsReview,
      stats: {
        total: rows.length,
        fastTrackCount: fastTrack.length,
        needsReviewCount: needsReview.length,
        finalizedCount: rows.filter((row) => row.decided).length,
      },
      page: query.page,
      limit: query.limit,
      returned: paged.length,
    };
  }

  async function getCommonMistakes(user, assignmentId) {
    const assignment = await getAssignmentForReview(user, assignmentId);
    const submissions = await submissionRepository.listByAssignment({
      assignmentId: assignment._id,
      status: null,
      skip: 0,
      limit: 0,
    });
    const reviewable = submissions.items.filter((submission) =>
      REVIEWABLE_STATUSES.includes(submission.status),
    );
    const totalSubmissions = reviewable.length;
    const evaluations = await aiEvaluationRepository.listByAssignment(assignment._id);

    const byCode = new Map();
    for (const evaluation of evaluations) {
      for (const misconception of evaluation.misconceptions ?? []) {
        const entry = byCode.get(misconception.code) ?? {
          code: misconception.code,
          description: misconception.description,
          affectedStudentIds: new Set(),
        };
        entry.affectedStudentIds.add(evaluation.studentId.toString());
        byCode.set(misconception.code, entry);
      }
    }

    const items = Array.from(byCode.values())
      .map((entry) => ({
        code: entry.code,
        description: entry.description,
        affectedStudentsCount: entry.affectedStudentIds.size,
        affectedStudentsPercentage:
          totalSubmissions === 0
            ? 0
            : Math.round((entry.affectedStudentIds.size / totalSubmissions) * 100),
        affectedStudentIds: Array.from(entry.affectedStudentIds),
      }))
      .sort((a, b) => b.affectedStudentsCount - a.affectedStudentsCount);

    return { items, totalSubmissions };
  }

  async function getGradedSubmissionForDecision(user, submissionId) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }
    const assignment = await assignmentRepository.findById(submission.assignmentId);
    if (!assignment) {
      throw new NotFoundError('Submission not found');
    }
    await coursesService.ensureInstructorCourseAccess(user, assignment.courseId.toString());
    if (submission.status !== SUBMISSION_STATUS.GRADED) {
      throw new ConflictError('Decisions are only allowed while the submission is GRADED');
    }
    return { submission, assignment };
  }

  async function totalMaxScore(assignmentId) {
    const questions = await assignmentQuestionRepository.listByAssignment(assignmentId);
    return questions.reduce((sum, question) => sum + question.maxScore, 0);
  }

  async function aiTotalFor(submissionId) {
    const evaluations = await aiEvaluationRepository.listBySubmission(submissionId);
    return evaluations.reduce((sum, evaluation) => sum + (evaluation.score ?? 0), 0);
  }

  async function approveSubmission(user, submissionId) {
    const { submission, assignment } = await getGradedSubmissionForDecision(user, submissionId);
    const attempt = await submissionAttemptRepository.findLatest(submission._id);
    const answers = attempt ? await submissionAnswerRepository.listByAttempt(attempt._id) : [];
    const evaluations = await aiEvaluationRepository.listBySubmission(submission._id);
    const evaluationByAnswer = new Map(
      evaluations.map((evaluation) => [String(evaluation.answerId), evaluation]),
    );
    const missing = answers.filter((answer) => !evaluationByAnswer.has(String(answer._id)));
    if (answers.length === 0 || missing.length > 0) {
      throw new ConflictError('Review is not ready: some answers have no AI evaluation yet');
    }

    const rows = answers.map((answer) => {
      const evaluation = evaluationByAnswer.get(String(answer._id));
      return {
        submissionId: submission._id,
        attemptId: attempt._id,
        assignmentId: assignment._id,
        answerId: answer._id,
        questionId: answer.questionId,
        finalScore: evaluation.score ?? 0,
        finalFeedback: evaluation.feedbackText ?? null,
        decidedBy: user.id,
        decision: FINAL_GRADE_DECISIONS.APPROVED,
        aiOriginalScore: evaluation.score ?? null,
      };
    });
    await finalGradeRepository.insertMany(rows);

    const finalTotal = rows.reduce((sum, row) => sum + row.finalScore, 0);
    const updated = await submissionRepository.updateById(submission._id, {
      status: SUBMISSION_STATUS.FINALIZED,
      finalScoreTotal: finalTotal,
      finalDecision: FINAL_GRADE_DECISIONS.APPROVED,
    });
    await auditService.record({
      courseId: assignment.courseId,
      assignmentId: assignment._id,
      submissionId: submission._id,
      actorId: user.id,
      action: AUDIT_ACTIONS.APPROVE,
      aiOriginalScore: await aiTotalFor(submission._id),
      finalScore: finalTotal,
    });
    return toPublicSubmission(updated);
  }

  async function applyManualDecision(user, submissionId, payload, decision, auditAction) {
    const { submission, assignment } = await getGradedSubmissionForDecision(user, submissionId);
    const maxTotal = await totalMaxScore(assignment._id);
    if (payload.score > maxTotal) {
      throw new AppError({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        message: `score cannot exceed the assignment total (${maxTotal})`,
      });
    }
    const attempt = await submissionAttemptRepository.findLatest(submission._id);
    await finalGradeRepository.insertMany([
      {
        submissionId: submission._id,
        attemptId: attempt?._id,
        assignmentId: assignment._id,
        answerId: null,
        questionId: null,
        finalScore: payload.score,
        finalFeedback: payload.feedback ?? null,
        decidedBy: user.id,
        decision,
        aiOriginalScore: await aiTotalFor(submission._id),
      },
    ]);
    const updated = await submissionRepository.updateById(submission._id, {
      status: SUBMISSION_STATUS.FINALIZED,
      finalScoreTotal: payload.score,
      finalFeedback: payload.feedback ?? null,
      finalDecision: decision,
    });
    await auditService.record({
      courseId: assignment.courseId,
      assignmentId: assignment._id,
      submissionId: submission._id,
      actorId: user.id,
      action: auditAction,
      aiOriginalScore: await aiTotalFor(submission._id),
      finalScore: payload.score,
      metadata: { feedback: payload.feedback ?? null },
    });
    return toPublicSubmission(updated);
  }

  async function editSubmission(user, submissionId, payload) {
    return applyManualDecision(user, submissionId, payload, FINAL_GRADE_DECISIONS.EDITED, AUDIT_ACTIONS.EDIT);
  }

  async function rejectSubmission(user, submissionId, payload) {
    return applyManualDecision(
      user,
      submissionId,
      payload,
      FINAL_GRADE_DECISIONS.REJECTED_MANUAL,
      AUDIT_ACTIONS.REJECT,
    );
  }

  async function requestResubmission(user, submissionId, payload) {
    const reason = (payload.reason ?? '').trim();
    if (!reason) {
      throw new AppError({
        statusCode: 422,
        code: 'REASON_REQUIRED',
        message: 'A resubmission reason is required',
      });
    }
    const { submission, assignment } = await getGradedSubmissionForDecision(user, submissionId);
    const nextAttemptNo = submission.currentAttemptNo + 1;
    await submissionAttemptRepository.create({
      submissionId: submission._id,
      attemptNo: nextAttemptNo,
    });
    const updated = await submissionRepository.updateById(submission._id, {
      status: SUBMISSION_STATUS.RESUBMISSION_REQUESTED,
      currentAttemptNo: nextAttemptNo,
      resubmissionReason: reason,
      finalScoreTotal: null,
      finalFeedback: null,
      finalDecision: null,
    });
    await auditService.record({
      courseId: assignment.courseId,
      assignmentId: assignment._id,
      submissionId: submission._id,
      actorId: user.id,
      action: AUDIT_ACTIONS.REQUEST_RESUBMISSION,
      aiOriginalScore: await aiTotalFor(submission._id),
      finalScore: null,
      reasonText: reason,
    });
    return toPublicSubmission(updated);
  }

  async function bulkApprove(user, assignmentId, payload) {
    const assignment = await getAssignmentForReview(user, assignmentId);
    const rows = await buildReviewRows(assignment, {});
    const rowById = new Map(
      rows.map((row) => [row.submission.id, row]),
    );

    const notEligible = payload.submissionIds.filter((id) => {
      const row = rowById.get(id);
      return !row || !row.fastTrackEligible || row.decided;
    });
    if (notEligible.length > 0) {
      throw notEligibleError({ submissionIds: notEligible });
    }

    const decided = [];
    for (const id of payload.submissionIds) {
      const submission = await submissionRepository.findById(id);
      const attempt = await submissionAttemptRepository.findLatest(id);
      const answers = attempt ? await submissionAnswerRepository.listByAttempt(attempt._id) : [];
      const evaluations = await aiEvaluationRepository.listBySubmission(id);
      const evaluationByAnswer = new Map(
        evaluations.map((evaluation) => [String(evaluation.answerId), evaluation]),
      );
      const gradeRows = answers.map((answer) => {
        const evaluation = evaluationByAnswer.get(String(answer._id));
        return {
          submissionId: submission._id,
          attemptId: attempt._id,
          assignmentId: assignment._id,
          answerId: answer._id,
          questionId: answer.questionId,
          finalScore: evaluation.score ?? 0,
          finalFeedback: evaluation.feedbackText ?? null,
          decidedBy: user.id,
          decision: FINAL_GRADE_DECISIONS.APPROVED,
          aiOriginalScore: evaluation.score ?? null,
        };
      });
      await finalGradeRepository.insertMany(gradeRows);
      const finalTotal = gradeRows.reduce((sum, row) => sum + row.finalScore, 0);
      const updated = await submissionRepository.updateById(submission._id, {
        status: SUBMISSION_STATUS.FINALIZED,
        finalScoreTotal: finalTotal,
        finalDecision: FINAL_GRADE_DECISIONS.APPROVED,
      });
      await auditService.record({
        courseId: assignment.courseId,
        assignmentId: assignment._id,
        submissionId: submission._id,
        actorId: user.id,
        action: AUDIT_ACTIONS.APPROVE,
        aiOriginalScore: await aiTotalFor(id),
        finalScore: finalTotal,
      });
      decided.push(toPublicSubmission(updated));
    }
    return { approved: decided.map((submission) => submission.id), count: decided.length };
  }

  async function listFinalGrades(submissionId) {
    const grades = await finalGradeRepository.listBySubmission(submissionId);
    return grades.map(toPublicFinalGrade);
  }

  return {
    getReview,
    getCommonMistakes,
    bulkApprove,
    approveSubmission,
    editSubmission,
    rejectSubmission,
    requestResubmission,
    listFinalGrades,
  };
}