import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';

export function createPracticeController({ practiceService }) {
  const startSession = asyncHandler(async (req, res) => {
    const session = await practiceService.startSession(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, session);
  });

  const getSession = asyncHandler(async (req, res) => {
    const session = await practiceService.getSession(
      req.user,
      req.validated.params.courseId,
      req.validated.params.practiceSessionId,
    );
    sendSuccess(res, { data: session });
  });

  const submitAnswer = asyncHandler(async (req, res) => {
    const result = await practiceService.submitAnswer(
      req.user,
      req.validated.params.courseId,
      req.validated.params.practiceSessionId,
      req.validated.body,
    );
    sendCreated(res, result);
  });

  return { startSession, getSession, submitAnswer };
}