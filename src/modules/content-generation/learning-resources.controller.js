import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendCreated, sendSuccess } from '../../shared/http/api-response.js';

export function createLearningResourcesController({ learningResourcesService }) {
  const generate = asyncHandler(async (req, res) => {
    const result = await learningResourcesService.generate(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, result);
  });

  const list = asyncHandler(async (req, res) => {
    const result = await learningResourcesService.listMine(
      req.user,
      req.validated.params.courseId,
      req.validated.query,
    );
    sendSuccess(res, {
      data: result.items,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  });

  const download = asyncHandler(async (req, res) => {
    const artifact = await learningResourcesService.downloadArtifact(
      req.user,
      req.validated.params.resourceId,
    );
    res.setHeader('content-type', artifact.mime);
    res.setHeader(
      'content-disposition',
      `attachment; filename="${encodeURIComponent(artifact.fileName)}"`,
    );
    res.send(artifact.buffer);
  });

  return { generate, list, download };
}
