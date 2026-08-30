import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';

export function createTutorController({ tutorService }) {
  const createSession = asyncHandler(async (req, res) => {
    const session = await tutorService.createSession(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, session);
  });

  const listSessions = asyncHandler(async (req, res) => {
    const sessions = await tutorService.listSessions(req.user, req.validated.params.courseId);
    sendSuccess(res, { data: sessions });
  });

  const getSession = asyncHandler(async (req, res) => {
    const session = await tutorService.getSession(
      req.user,
      req.validated.params.courseId,
      req.validated.params.tutorSessionId,
    );
    sendSuccess(res, { data: session });
  });

  const askQuestion = asyncHandler(async (req, res) => {
    const result = await tutorService.askQuestion(
      req.user,
      req.validated.params.courseId,
      req.validated.params.tutorSessionId,
      req.validated.body,
    );
    sendCreated(res, result);
  });

  return { createSession, listSessions, getSession, askQuestion };
}