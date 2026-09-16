import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess } from '../../shared/http/api-response.js';

export function createSubmissionsController({ submissionsService }) {
  const autosaveAnswer = asyncHandler(async (req, res) => {
    const result = await submissionsService.autosaveAnswer(
      req.user,
      req.validated.params.assignmentId,
      req.validated.params.questionId,
      req.validated.body,
    );
    sendSuccess(res, { data: result });
  });

  const submit = asyncHandler(async (req, res) => {
    const submission = await submissionsService.submitAssignment(
      req.user,
      req.validated.params.assignmentId,
    );
    sendSuccess(res, { data: submission });
  });

  const getResult = asyncHandler(async (req, res) => {
    const result = await submissionsService.getStudentResult(
      req.user,
      req.validated.params.assignmentId,
    );
    sendSuccess(res, { data: result });
  });

  return { autosaveAnswer, submit, getResult };
}