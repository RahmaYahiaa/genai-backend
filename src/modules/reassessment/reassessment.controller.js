import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';

export function createReassessmentController({ reassessmentService }) {
  const startSession = asyncHandler(async (req, res) => {
    const session = await reassessmentService.startSession(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, session);
  });

  const listSessions = asyncHandler(async (req, res) => {
    const sessions = await reassessmentService.listSessions(
      req.user,
      req.validated.params.courseId,
    );
    sendSuccess(res, { data: sessions });
  });

  const getSession = asyncHandler(async (req, res) => {
    const session = await reassessmentService.getSession(
      req.user,
      req.validated.params.courseId,
      req.validated.params.reassessmentId,
    );
    sendSuccess(res, { data: session });
  });

  const submitAnswer = asyncHandler(async (req, res) => {
    const result = await reassessmentService.submitAnswer(
      req.user,
      req.validated.params.courseId,
      req.validated.params.reassessmentId,
      req.validated.body,
    );
    sendCreated(res, result);
  });

  const getLearningGain = asyncHandler(async (req, res) => {
    const report = await reassessmentService.getLearningGain(
      req.user,
      req.validated.params.courseId,
    );
    sendSuccess(res, { data: report });
  });

  return { startSession, listSessions, getSession, submitAnswer, getLearningGain };
}