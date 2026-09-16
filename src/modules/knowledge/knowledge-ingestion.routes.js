import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in
// `knowledge-ingestion.docs.js` (docs separated from routing logic).
//
// Access control lives in the service: upload/delete reuse the course write
// rules (institution admin/course staff for institutional courses, personal
// owner for personal spaces); reads reuse the course read rules.
export function createKnowledgeIngestionRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.post(
    '/courses/:courseId/materials',
    validators.courseIdParam,
    validators.createMaterial,
    controller.uploadMaterial,
  );

  router.post(
    '/courses/:courseId/materials/file',
    middlewares.uploadMaterialFile,
    validators.courseIdParam,
    validators.uploadMaterialFileFields,
    controller.uploadMaterialFile,
  );

  router.get(
    '/courses/:courseId/materials',
    validators.courseIdParam,
    validators.listMaterialsQuery,
    controller.listMaterials,
  );

  router.get(
    '/courses/:courseId/materials/:materialId',
    validators.materialIdParam,
    controller.getMaterial,
  );

  router.get(
    '/courses/:courseId/materials/:materialId/file',
    validators.materialIdParam,
    controller.downloadMaterialFile,
  );

  router.patch(
    '/courses/:courseId/materials/:materialId',
    validators.materialIdParam,
    validators.renameMaterial,
    controller.renameMaterial,
  );

  router.delete(
    '/courses/:courseId/materials/:materialId',
    validators.materialIdParam,
    controller.deleteMaterial,
  );

  router.get(
    '/courses/:courseId/materials/:materialId/chunks',
    validators.materialIdParam,
    validators.listChunksQuery,
    controller.listChunks,
  );

  return router;
}