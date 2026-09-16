import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess } from '../../shared/http/api-response.js';

export function createRemedialController({ remedialService }) {
  const generate = asyncHandler(async (req, res) => {
    const remedial = await remedialService.generateDraft(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendSuccess(res, { data: remedial });
  });

  const list = asyncHandler(async (req, res) => {
    const result = await remedialService.listCourseRemedial(
      req.user,
      req.validated.params.courseId,
      req.validated.query,
    );
    sendSuccess(res, { data: result });
  });

  const getOne = asyncHandler(async (req, res) => {
    const remedial = await remedialService.getRemedial(
      req.user,
      req.validated.params.courseId,
      req.validated.params.remedialId,
    );
    sendSuccess(res, { data: remedial });
  });

  const updateDraft = asyncHandler(async (req, res) => {
    const remedial = await remedialService.updateDraft(
      req.user,
      req.validated.params.courseId,
      req.validated.params.remedialId,
      req.validated.body,
    );
    sendSuccess(res, { data: remedial });
  });

  const publish = asyncHandler(async (req, res) => {
    const remedial = await remedialService.publishRemedial(
      req.user,
      req.validated.params.courseId,
      req.validated.params.remedialId,
      req.validated.body,
    );
    sendSuccess(res, { data: remedial });
  });

  const listMine = asyncHandler(async (req, res) => {
    const result = await remedialService.listMyRemedial(
      req.user,
      req.validated.params.courseId,
    );
    sendSuccess(res, { data: result });
  });

  return { generate, list, getOne, updateDraft, publish, listMine };
}