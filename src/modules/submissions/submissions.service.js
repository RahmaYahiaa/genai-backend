import {
  ROLES,
  ASSIGNMENT_STATUS,
  ASSIGNMENT_QUESTION_TYPES,
  OBJECTIVE_QUESTION_TYPES,
  SUBMISSION_STATUS,
  ERROR_CODES,
} from '../../config/constants.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors/index.js';
import { toPublicAssignment } from '../assignments/assignment.model.js';
import { toPublicSubmission } from './submission.model.js';
import { toPublicSubmissionAttempt } from './submission-attempt.model.js';
import { toPublicSubmissionAnswer } from './submission-answer.model.js';

const EDITABLE_SUBMISSION_STATUSES = [
  SUBMISSION_STATUS.DRAFT,
  SUBMISSION_STATUS.RESUBMISSION_REQUESTED,
];

function assignmentClosedError() {
  return new AppError({
    statusCode: 409,
    code: ERROR_CODES.ASSIGNMENT_CLOSED,
    message: 'Assignment is closed',
  });
}

export function createSubmissionsService({
  submissionRepository,
  submissionAttemptRepository,
  submissionAnswerRepository,
  assignmentRepository,
  assignmentQuestionRepository,
  coursesService,
  enrollmentRepository,
  gradingQueue,
  finalGradeRepository,
}) {
  async function getEnrolledStudentAssignment(user, assignmentId) {
    if (user.role !== ROLES.STUDENT) {
      throw new ForbiddenError('Only enrolled students can access assignments as students');
    }
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    if (assignment.status === ASSIGNMENT_STATUS.DRAFT) {
      throw new NotFoundError('Assignment not found');
    }
    await coursesService.ensureInstitutionalCourseAccess(user, assignment.courseId.toString());
    const enrolled = await enrollmentRepository.exists(user.id, assignment.courseId);
    if (!enrolled) {
      throw new NotFoundError('Assignment not found');
    }
    return assignment;
  }

  async function getEditableSubmission(assignment, user) {
    const submission = await submissionRepository.findByAssignmentAndStudent(
      assignment._id,
      user.id,
    );
    if (submission && !EDITABLE_SUBMISSION_STATUSES.includes(submission.status)) {
      throw new ConflictError('Submission already submitted');
    }
    return submission;
  }

  async function getOrCreateLatestAttempt(submission) {
    let attempt = await submissionAttemptRepository.findLatest(submission._id);
    if (!attempt) {
      attempt = await submissionAttemptRepository.create({
        submissionId: submission._id,
        attemptNo: submission.currentAttemptNo ?? 1,
      });
    }
    return attempt;
  }

  async function getStudentAssignmentView(user, assignmentId) {
    const assignment = await getEnrolledStudentAssignment(user, assignmentId);
    const questions = await assignmentQuestionRepository.listByAssignment(assignment._id);
    const submission = await submissionRepository.findByAssignmentAndStudent(
      assignment._id,
      user.id,
    );
    const canSubmit =
      assignment.status === ASSIGNMENT_STATUS.OPEN &&
      (!submission || EDITABLE_SUBMISSION_STATUSES.includes(submission.status));
    const resubmissionRequest =
      submission && submission.status === SUBMISSION_STATUS.RESUBMISSION_REQUESTED
        ? await buildResubmissionRequest(submission)
        : null;
    return {
      ...toPublicAssignment(assignment),
      questions: questions.map((question) => ({
        id: question._id.toString(),
        orderIndex: question.orderIndex,
        questionText: question.questionText,
        topicId: question.topicId.toString(),
        maxScore: question.maxScore,
        questionType: question.questionType ?? ASSIGNMENT_QUESTION_TYPES.ESSAY,
        options: (question.options ?? []).map((option) => ({ id: option.id, text: option.text })),
      })),
      canSubmit,
      submission: submission ? toPublicSubmission(submission) : null,
      resubmissionRequest,
    };
  }

  async function buildResubmissionRequest(submission) {
    const attempts = await submissionAttemptRepository.listBySubmission(submission._id);
    const previous = attempts.filter((a) => a.attemptNo < submission.currentAttemptNo).pop();
    const answers = previous ? await submissionAnswerRepository.listByAttempt(previous._id) : [];
    return {
      reason: submission.resubmissionReason ?? null,
      previousAttemptNo: previous?.attemptNo ?? null,
      prefilledAnswers: answers.map((answer) => ({
        questionId: answer.questionId.toString(),
        answerText: answer.answerText ?? null,
        selectedOptionIds: answer.selectedOptionIds ?? null,
        imageUrl: answer.imageUrl ?? null,
      })),
    };
  }

  async function getStudentResult(user, assignmentId) {
    const assignment = await getEnrolledStudentAssignment(user, assignmentId);
    const submission = await submissionRepository.findByAssignmentAndStudent(
      assignment._id,
      user.id,
    );
    if (!submission) {
      return { available: false, reason: 'NOT_SUBMITTED' };
    }
    if (submission.status === SUBMISSION_STATUS.RESUBMISSION_REQUESTED) {
      return {
        available: false,
        reason: 'RESUBMISSION_REQUESTED',
        resubmissionRequest: await buildResubmissionRequest(submission),
      };
    }
    if (submission.status !== SUBMISSION_STATUS.FINALIZED) {
      return { available: false, reason: 'NOT_FINALIZED' };
    }
    if (!assignment.showGradeToStudent) {
      return { available: false, reason: 'GRADES_HIDDEN' };
    }
    const grades = await finalGradeRepository.listBySubmission(submission._id);
    return {
      available: true,
      result: {
        submissionId: submission._id.toString(),
        finalScoreTotal: submission.finalScoreTotal ?? null,
        finalFeedback: submission.finalFeedback ?? null,
        finalDecision: submission.finalDecision ?? null,
        decidedAt: submission.updatedAt,
        answers: grades
          .filter((grade) => grade.answerId)
          .map((grade) => ({
            questionId: grade.questionId ? grade.questionId.toString() : null,
            finalScore: grade.finalScore,
            finalFeedback: grade.finalFeedback ?? null,
          })),
      },
    };
  }

  async function autosaveAnswer(user, assignmentId, questionId, payload) {
    const assignment = await getEnrolledStudentAssignment(user, assignmentId);
    if (assignment.status === ASSIGNMENT_STATUS.CLOSED) {
      throw assignmentClosedError();
    }
    const question = await assignmentQuestionRepository.findById(questionId);
    if (!question || String(question.assignmentId) !== String(assignment._id)) {
      throw new NotFoundError('Question not found');
    }

    const submission = await getEditableSubmission(assignment, user) ??
      (await submissionRepository.create({
        assignmentId: assignment._id,
        studentId: user.id,
      }));
    const attempt = await getOrCreateLatestAttempt(submission);

    const questionType = question.questionType ?? ASSIGNMENT_QUESTION_TYPES.ESSAY;
    const isObjective = OBJECTIVE_QUESTION_TYPES.includes(questionType);

    let uniqueSelection = null;
    if (payload.selectedOptionIds !== undefined) {
      if (!isObjective) {
        throw new UnprocessableEntityError(
          `selectedOptionIds is only accepted for objective questions (multiple_choice, multiple_select, true_false) - this question is ${questionType}`,
        );
      }
      const knownIds = new Set((question.options ?? []).map((option) => option.id));
      uniqueSelection = [...new Set(payload.selectedOptionIds)];
      if (uniqueSelection.some((id) => !knownIds.has(id))) {
        throw new UnprocessableEntityError('selectedOptionIds contains an option that does not belong to this question');
      }
      if (questionType !== ASSIGNMENT_QUESTION_TYPES.MULTIPLE_SELECT && uniqueSelection.length !== 1) {
        throw new UnprocessableEntityError('select exactly one option for multiple_choice and true_false questions');
      }
    }

    const update = { savedAt: new Date() };
    if (uniqueSelection !== null) {
      update.selectedOptionIds = uniqueSelection;
      update.answerText = null;
    } else if (payload.answerText !== undefined) {
      if (isObjective) {
        throw new UnprocessableEntityError(
          `answerText is not accepted for ${questionType} questions - use selectedOptionIds`,
        );
      }
      update.answerText = payload.answerText;
    }
    if (payload.imageUrl !== undefined) {
      if (isObjective) {
        throw new UnprocessableEntityError(`imageUrl is not accepted for ${questionType} questions - use selectedOptionIds`);
      }
      update.imageUrl = payload.imageUrl;
    }
    const answer = await submissionAnswerRepository.upsert(attempt._id, question._id, update);

    return {
      answer: toPublicSubmissionAnswer(answer),
      attempt: toPublicSubmissionAttempt(attempt),
      submission: toPublicSubmission(submission),
    };
  }

  async function submitAssignment(user, assignmentId) {
    const assignment = await getEnrolledStudentAssignment(user, assignmentId);
    if (assignment.status === ASSIGNMENT_STATUS.CLOSED) {
      throw assignmentClosedError();
    }

    const submission = await submissionRepository.findByAssignmentAndStudent(
      assignment._id,
      user.id,
    );
    if (!submission) {
      throw new UnprocessableEntityError('Answer at least one question before submitting');
    }
    if (!EDITABLE_SUBMISSION_STATUSES.includes(submission.status)) {
      throw new ConflictError('Submission already submitted');
    }

    const attempt = await submissionAttemptRepository.findLatest(submission._id);
    const answeredCount = attempt
      ? await submissionAnswerRepository.countByAttempt(attempt._id)
      : 0;
    if (!attempt || answeredCount === 0) {
      throw new UnprocessableEntityError('Answer at least one question before submitting');
    }

    const submittedAt = new Date();
    await submissionAttemptRepository.markSubmitted(attempt._id, submittedAt);
    const updated = await submissionRepository.updateById(submission._id, {
      status: SUBMISSION_STATUS.SUBMITTED,
      submittedAt,
    });
    gradingQueue.enqueue(updated._id);
    return toPublicSubmission(updated);
  }

  return {
    getStudentAssignmentView,
    getStudentResult,
    autosaveAnswer,
    submitAssignment,
  };
}
