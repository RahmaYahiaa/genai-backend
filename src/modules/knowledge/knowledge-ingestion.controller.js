import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated, buildPaginationMeta } from '../../shared/http/api-response.js';

export function createKnowledgeIngestionController({ knowledgeIngestionService }) {
  const uploadMaterial = asyncHandler(async (req, res) => {
    const material = await knowledgeIngestionService.uploadMaterial(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, material);
  });

  const listMaterials = asyncHandler(async (req, res) => {
    const { page, limit } = req.validated.query;
    const { items, total } = await knowledgeIngestionService.listMaterials(
      req.user,
      req.validated.params.courseId,
      { page, limit },
    );
    sendSuccess(res, { data: items, meta: buildPaginationMeta({ page, limit, total }) });
  });

  const getMaterial = asyncHandler(async (req, res) => {
    const material = await knowledgeIngestionService.getMaterial(
      req.user,
      req.validated.params.courseId,
      req.validated.params.materialId,
    );
    sendSuccess(res, { data: material });
  });

  const deleteMaterial = asyncHandler(async (req, res) => {
    const result = await knowledgeIngestionService.deleteMaterial(
      req.user,
      req.validated.params.courseId,
      req.validated.params.materialId,
    );
    sendSuccess(res, { data: result });
  });

  const listChunks = asyncHandler(async (req, res) => {
    const { page, limit } = req.validated.query;
    const { items, total } = await knowledgeIngestionService.listChunks(
      req.user,
      req.validated.params.courseId,
      req.validated.params.materialId,
      { page, limit },
    );
    sendSuccess(res, { data: items, meta: buildPaginationMeta({ page, limit, total }) });
  });

  return {
    uploadMaterial,
    listMaterials,
    getMaterial,
    deleteMaterial,
    listChunks,
  };
}