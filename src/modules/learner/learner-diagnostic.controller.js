import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';

export function createLearnerDiagnosticController({ learnerDiagnosticService }) {
  const getLearnerProfile = asyncHandler(async (req, res) => {
    const profile = await learnerDiagnosticService.getOrCreateLearnerProfile(
      req.user,
      req.validated.params.courseId,
    );
    sendSuccess(res, { data: profile });
  });

  const startDiagnostic = asyncHandler(async (req, res) => {
    const assessment = await learnerDiagnosticService.startDiagnostic(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, assessment);
  });

  const getDiagnostic = asyncHandler(async (req, res) => {
    const assessment = await learnerDiagnosticService.getDiagnostic(
      req.user,
      req.validated.params.courseId,
      req.validated.params.diagnosticId,
    );
    sendSuccess(res, { data: assessment });
  });

  const submitAnswer = asyncHandler(async (req, res) => {
    const result = await learnerDiagnosticService.submitAnswer(
      req.user,
      req.validated.params.courseId,
      req.validated.params.diagnosticId,
      req.validated.body,
    );
    sendCreated(res, result);
  });

  const listEvidence = asyncHandler(async (req, res) => {
    const evidence = await learnerDiagnosticService.listAssessmentEvidence(
      req.user,
      req.validated.params.courseId,
      req.validated.params.diagnosticId,
    );
    sendSuccess(res, { data: evidence });
  });

  return {
    getLearnerProfile,
    startDiagnostic,
    getDiagnostic,
    submitAnswer,
    listEvidence,
  };
}