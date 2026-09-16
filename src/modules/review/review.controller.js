import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess } from '../../shared/http/api-response.js';

export function createReviewController({ reviewService }) {
  const getReview = asyncHandler(async (req, res) => {
    const review = await reviewService.getReview(
      req.user,
      req.validated.params.assignmentId,
      req.validated.query,
    );
    sendSuccess(res, { data: review });
  });

  const getCommonMistakes = asyncHandler(async (req, res) => {
    const result = await reviewService.getCommonMistakes(
      req.user,
      req.validated.params.assignmentId,
    );
    sendSuccess(res, { data: result });
  });

  const bulkApprove = asyncHandler(async (req, res) => {
    const result = await reviewService.bulkApprove(
      req.user,
      req.validated.params.assignmentId,
      req.validated.body,
    );
    sendSuccess(res, { data: result });
  });

  const approveSubmission = asyncHandler(async (req, res) => {
    const submission = await reviewService.approveSubmission(
      req.user,
      req.validated.params.submissionId,
    );
    sendSuccess(res, { data: submission });
  });

  const editSubmission = asyncHandler(async (req, res) => {
    const submission = await reviewService.editSubmission(
      req.user,
      req.validated.params.submissionId,
      req.validated.body,
    );
    sendSuccess(res, { data: submission });
  });

  const rejectSubmission = asyncHandler(async (req, res) => {
    const submission = await reviewService.rejectSubmission(
      req.user,
      req.validated.params.submissionId,
      req.validated.body,
    );
    sendSuccess(res, { data: submission });
  });

  const requestResubmission = asyncHandler(async (req, res) => {
    const submission = await reviewService.requestResubmission(
      req.user,
      req.validated.params.submissionId,
      req.validated.body,
    );
    sendSuccess(res, { data: submission });
  });

  return {
    getReview,
    getCommonMistakes,
    bulkApprove,
    approveSubmission,
    editSubmission,
    rejectSubmission,
    requestResubmission,
  };
}