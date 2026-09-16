import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated, buildPaginationMeta } from '../../shared/http/api-response.js';
import { ROLES } from '../../config/constants.js';

export function createAssignmentsController({ assignmentsService, submissionsService }) {
  const createAssignment = asyncHandler(async (req, res) => {
    const assignment = await assignmentsService.createAssignment(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, assignment);
  });

  const updateAssignment = asyncHandler(async (req, res) => {
    const assignment = await assignmentsService.updateAssignment(
      req.user,
      req.validated.params.assignmentId,
      req.validated.body,
    );
    sendSuccess(res, { data: assignment });
  });

  const listAssignments = asyncHandler(async (req, res) => {
    const { items, total } = await assignmentsService.listAssignments(
      req.user,
      req.validated.params.courseId,
      req.validated.query,
    );
    sendSuccess(res, {
      data: items,
      meta: buildPaginationMeta({
        page: req.validated.query.page,
        limit: req.validated.query.limit,
        total,
      }),
    });
  });

  const getAssignment = asyncHandler(async (req, res) => {
    const data =
      req.user.role === ROLES.STUDENT
        ? await submissionsService.getStudentAssignmentView(
            req.user,
            req.validated.params.assignmentId,
          )
        : await assignmentsService.getAssignmentForInstructor(
            req.user,
            req.validated.params.assignmentId,
          );
    sendSuccess(res, { data });
  });

  const addQuestion = asyncHandler(async (req, res) => {
    const question = await assignmentsService.addQuestion(
      req.user,
      req.validated.params.assignmentId,
      req.validated.body,
    );
    sendCreated(res, question);
  });

  const updateQuestion = asyncHandler(async (req, res) => {
    const question = await assignmentsService.updateQuestion(
      req.user,
      req.validated.params.assignmentId,
      req.validated.params.questionId,
      req.validated.body,
    );
    sendSuccess(res, { data: question });
  });

  const deleteQuestion = asyncHandler(async (req, res) => {
    const result = await assignmentsService.deleteQuestion(
      req.user,
      req.validated.params.assignmentId,
      req.validated.params.questionId,
    );
    sendSuccess(res, { data: result });
  });

  const publish = asyncHandler(async (req, res) => {
    const assignment = await assignmentsService.publishAssignment(
      req.user,
      req.validated.params.assignmentId,
    );
    sendSuccess(res, { data: assignment });
  });

  const close = asyncHandler(async (req, res) => {
    const assignment = await assignmentsService.closeAssignment(
      req.user,
      req.validated.params.assignmentId,
    );
    sendSuccess(res, { data: assignment });
  });

  const reopen = asyncHandler(async (req, res) => {
    const assignment = await assignmentsService.reopenAssignment(
      req.user,
      req.validated.params.assignmentId,
    );
    sendSuccess(res, { data: assignment });
  });

  const setGradeVisibility = asyncHandler(async (req, res) => {
    const assignment = await assignmentsService.setGradeVisibility(
      req.user,
      req.validated.params.assignmentId,
      req.validated.body,
    );
    sendSuccess(res, { data: assignment });
  });

  return {
    createAssignment,
    updateAssignment,
    listAssignments,
    getAssignment,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    publish,
    close,
    reopen,
    setGradeVisibility,
  };
}