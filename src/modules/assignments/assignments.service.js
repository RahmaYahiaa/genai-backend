import { isValidObjectId } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  ROLES,
  ASSIGNMENT_STATUS,
  ASSIGNMENT_QUESTION_TYPES,
  OBJECTIVE_QUESTION_TYPES,
  AUDIT_ACTIONS,
  COURSE_STAFF_ROLES,
} from '../../config/constants.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors/index.js';
import { toPublicAssignment } from './assignment.model.js';
import { toPublicAssignmentQuestion } from './assignment-question.model.js';

const TRANSITIONS = {
  [ASSIGNMENT_STATUS.DRAFT]: [ASSIGNMENT_STATUS.OPEN],
  [ASSIGNMENT_STATUS.OPEN]: [ASSIGNMENT_STATUS.CLOSED],
  [ASSIGNMENT_STATUS.CLOSED]: [ASSIGNMENT_STATUS.OPEN],
};

export function createAssignmentsService({
  assignmentRepository,
  assignmentQuestionRepository,
  coursesService,
  auditService,
  domainEvents,
}) {
  function assertAuthoringRole(course, user) {
    const isAdmin =
      user.role === ROLES.INSTITUTION_ADMIN &&
      String(user.institutionId) === String(course.institutionId);
    if (isAdmin) return;
    const isInstructor = (course.staff ?? []).some(
      (member) =>
        String(member.userId) === String(user.id) &&
        member.role === COURSE_STAFF_ROLES.INSTRUCTOR,
    );
    if (isInstructor) return;
    throw new ForbiddenError('Only course instructors and institution admins can manage assignments');
  }

  async function getCourseForAuthoring(user, courseId) {
    const course = await coursesService.ensureInstitutionalCourseAccess(user, courseId);
    assertAuthoringRole(course, user);
    return course;
  }

  async function getAuthorizedAssignment(user, assignmentId) {
    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    const course = await getCourseForAuthoring(user, assignment.courseId.toString());
    return { assignment, course };
  }

  function assertTopicInCourse(course, topicId) {
    if (!topicId) {
      throw new UnprocessableEntityError('topicId is required');
    }
    if (!isValidObjectId(topicId)) {
      throw new UnprocessableEntityError('topicId is not a valid identifier');
    }
    const exists = (course.topics ?? []).some((topic) => String(topic._id) === String(topicId));
    if (!exists) {
      throw new UnprocessableEntityError('topicId does not belong to this course');
    }
  }

  async function createAssignment(user, courseId, payload) {
    const course = await getCourseForAuthoring(user, courseId);
    const created = await assignmentRepository.create({
      courseId: course._id,
      createdBy: user.id,
      title: payload.title,
    });
    return toPublicAssignment(created);
  }

  async function updateAssignment(user, assignmentId, payload) {
    const { assignment } = await getAuthorizedAssignment(user, assignmentId);
    const updated = await assignmentRepository.updateById(assignment._id, {
      title: payload.title,
    });
    return toPublicAssignment(updated);
  }

  async function listAssignments(user, courseId, query) {
    if (user.role === ROLES.STUDENT) {
      const course = await coursesService.ensureStudentCourseAccess(user, courseId);
      if (course.isPersonal || query.status === ASSIGNMENT_STATUS.DRAFT) {
        return { items: [], total: 0 };
      }
      const { items, total } = await assignmentRepository.listByCourse({
        courseId,
        status: query.status,
        skip: (query.page - 1) * query.limit,
        limit: query.limit,
      });
      const visible = query.status
        ? items
        : items.filter((item) => item.status !== ASSIGNMENT_STATUS.DRAFT);
      return {
        items: visible.map(toPublicAssignment),
        total: query.status ? total : visible.length,
      };
    }
    await getCourseForAuthoring(user, courseId);
    const { items, total } = await assignmentRepository.listByCourse({
      courseId,
      status: query.status,
      skip: (query.page - 1) * query.limit,
      limit: query.limit,
    });
    return { items: items.map(toPublicAssignment), total };
  }

  async function getAssignmentForInstructor(user, assignmentId) {
    const { assignment } = await getAuthorizedAssignment(user, assignmentId);
    const questions = await assignmentQuestionRepository.listByAssignment(assignment._id);
    return {
      ...toPublicAssignment(assignment),
      questions: questions.map(toPublicAssignmentQuestion),
    };
  }

  function materializeAnswerKey(questionType, payload) {
    if (questionType === ASSIGNMENT_QUESTION_TYPES.TRUE_FALSE) {
      const trueOption = { id: randomUUID(), text: 'True' };
      const falseOption = { id: randomUUID(), text: 'False' };
      return {
        options: [trueOption, falseOption],
        correctOptionIds: [payload.correctAnswer ? trueOption.id : falseOption.id],
      };
    }
    const options = payload.options.map((option) => ({ id: randomUUID(), text: option.text }));
    const indexes = [...new Set(payload.correctOptionIndexes ?? [])];
    if (indexes.some((index) => index >= options.length)) {
      throw new UnprocessableEntityError('correctOptionIndexes references a non-existing option index');
    }
    if (questionType === ASSIGNMENT_QUESTION_TYPES.MULTIPLE_CHOICE && indexes.length !== 1) {
      throw new UnprocessableEntityError('multiple_choice questions take exactly one correct option');
    }
    return {
      options,
      correctOptionIds: indexes.map((index) => options[index].id),
    };
  }

  async function addQuestion(user, assignmentId, payload) {
    const { assignment, course } = await getAuthorizedAssignment(user, assignmentId);
    assertTopicInCourse(course, payload.topicId);
    const orderIndex =
      payload.orderIndex ?? (await assignmentQuestionRepository.nextOrderIndex(assignment._id));
    const questionType = payload.questionType ?? ASSIGNMENT_QUESTION_TYPES.ESSAY;
    let options = [];
    let correctOptionIds = [];
    if (OBJECTIVE_QUESTION_TYPES.includes(questionType)) {
      const answerKey = materializeAnswerKey(questionType, payload);
      options = answerKey.options;
      correctOptionIds = answerKey.correctOptionIds;
    }
    const created = await assignmentQuestionRepository.create({
      assignmentId: assignment._id,
      orderIndex,
      questionText: payload.questionText,
      topicId: payload.topicId,
      maxScore: payload.maxScore,
      modelAnswer: payload.modelAnswer ?? null,
      rubricText: payload.rubricText ?? null,
      questionType,
      options,
      correctOptionIds,
    });
    return toPublicAssignmentQuestion(created);
  }

  async function updateQuestion(user, assignmentId, questionId, payload) {
    const { assignment, course } = await getAuthorizedAssignment(user, assignmentId);
    const question = await assignmentQuestionRepository.findById(questionId);
    if (!question || String(question.assignmentId) !== String(assignment._id)) {
      throw new NotFoundError('Question not found');
    }
    const update = {};
    if (payload.questionText !== undefined) update.questionText = payload.questionText;
    if (payload.topicId !== undefined) {
      assertTopicInCourse(course, payload.topicId);
      update.topicId = payload.topicId;
    }
    if (payload.maxScore !== undefined) update.maxScore = payload.maxScore;
    if (payload.orderIndex !== undefined) update.orderIndex = payload.orderIndex;
    if (payload.modelAnswer !== undefined) update.modelAnswer = payload.modelAnswer;
    if (payload.rubricText !== undefined) update.rubricText = payload.rubricText;
    if (payload.correctOptionIndexes !== undefined) {
      const questionType = question.questionType ?? ASSIGNMENT_QUESTION_TYPES.ESSAY;
      if (
        questionType !== ASSIGNMENT_QUESTION_TYPES.MULTIPLE_CHOICE &&
        questionType !== ASSIGNMENT_QUESTION_TYPES.MULTIPLE_SELECT
      ) {
        throw new UnprocessableEntityError(
          'correctOptionIndexes only applies to multiple_choice and multiple_select questions',
        );
      }
      const indexes = [...new Set(payload.correctOptionIndexes)];
      const optionCount = (question.options ?? []).length;
      if (indexes.some((index) => index >= optionCount)) {
        throw new UnprocessableEntityError('correctOptionIndexes references a non-existing option index');
      }
      if (questionType === ASSIGNMENT_QUESTION_TYPES.MULTIPLE_CHOICE && indexes.length !== 1) {
        throw new UnprocessableEntityError('multiple_choice questions take exactly one correct option');
      }
      update.correctOptionIds = indexes.map((index) => question.options[index].id);
    }
    if (payload.correctAnswer !== undefined) {
      const questionType = question.questionType ?? ASSIGNMENT_QUESTION_TYPES.ESSAY;
      if (questionType !== ASSIGNMENT_QUESTION_TYPES.TRUE_FALSE) {
        throw new UnprocessableEntityError('correctAnswer only applies to true_false questions');
      }
      const target = (question.options ?? []).find(
        (option) => option.text === (payload.correctAnswer ? 'True' : 'False'),
      );
      if (!target) {
        throw new UnprocessableEntityError('true_false options are missing');
      }
      update.correctOptionIds = [target.id];
    }
    const updated = await assignmentQuestionRepository.updateById(question._id, update);
    return toPublicAssignmentQuestion(updated);
  }

  async function deleteQuestion(user, assignmentId, questionId) {
    const { assignment } = await getAuthorizedAssignment(user, assignmentId);
    const question = await assignmentQuestionRepository.deleteById(assignment._id, questionId);
    if (!question) {
      throw new NotFoundError('Question not found');
    }
    return { id: question._id.toString(), deleted: true };
  }

  async function transition(user, assignmentId, target) {
    const { assignment } = await getAuthorizedAssignment(user, assignmentId);
    const allowed = TRANSITIONS[assignment.status] ?? [];
    if (!allowed.includes(target)) {
      throw new ConflictError(`Cannot move assignment from ${assignment.status} to ${target}`);
    }
    if (target === ASSIGNMENT_STATUS.OPEN && assignment.status === ASSIGNMENT_STATUS.DRAFT) {
      const questionCount = await assignmentQuestionRepository.countByAssignment(assignment._id);
      if (questionCount === 0) {
        throw new UnprocessableEntityError('Add at least one question before publishing');
      }
    }
    const updated = await assignmentRepository.updateById(assignment._id, { status: target });
    domainEvents.emit('AssignmentClosed', {
      courseId: assignment.courseId.toString(),
      assignmentId: updated._id.toString(),
      status: target,
    });
    return toPublicAssignment(updated);
  }

  async function setGradeVisibility(user, assignmentId, payload) {
    const { assignment } = await getAuthorizedAssignment(user, assignmentId);
    const updated = await assignmentRepository.updateById(assignment._id, {
      showGradeToStudent: payload.showGradeToStudent,
    });
    await auditService.record({
      courseId: assignment.courseId,
      assignmentId: assignment._id,
      actorId: user.id,
      action: AUDIT_ACTIONS.TOGGLE_GRADE_VISIBILITY,
      metadata: { from: assignment.showGradeToStudent, to: payload.showGradeToStudent },
    });
    return toPublicAssignment(updated);
  }

  return {
    createAssignment,
    updateAssignment,
    listAssignments,
    getAssignmentForInstructor,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    publishAssignment: (user, assignmentId) => transition(user, assignmentId, ASSIGNMENT_STATUS.OPEN),
    closeAssignment: (user, assignmentId) => transition(user, assignmentId, ASSIGNMENT_STATUS.CLOSED),
    reopenAssignment: (user, assignmentId) => transition(user, assignmentId, ASSIGNMENT_STATUS.OPEN),
    setGradeVisibility,
  };
}