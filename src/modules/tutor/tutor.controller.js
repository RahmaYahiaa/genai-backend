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

  const renameSession = asyncHandler(async (req, res) => {
    const { courseId, tutorSessionId } = req.validated.params;
    const session = await tutorService.renameSession(req.user, courseId, tutorSessionId, req.validated.body.title);
    sendSuccess(res, { data: session });
  });

  const deleteSession = asyncHandler(async (req, res) => {
    const { courseId, tutorSessionId } = req.validated.params;
    const result = await tutorService.deleteSession(req.user, courseId, tutorSessionId);
    sendSuccess(res, { data: result });
  });

  return { createSession, listSessions, getSession, askQuestion, renameSession, deleteSession };
}