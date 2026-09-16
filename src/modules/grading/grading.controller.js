import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess } from '../../shared/http/api-response.js';

export function createGradingController({ gradingService }) {
  const previewEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await gradingService.previewForInstructor(
      req.user,
      req.validated.params.assignmentId,
      req.validated.params.questionId,
      req.validated.body,
    );
    sendSuccess(res, { data: { ...evaluation, persisted: false } });
  });

  const getSubmissionDetail = asyncHandler(async (req, res) => {
    const detail = await gradingService.getSubmissionDetail(
      req.user,
      req.validated.params.submissionId,
    );
    sendSuccess(res, { data: detail });
  });

  return { previewEvaluation, getSubmissionDetail };
}