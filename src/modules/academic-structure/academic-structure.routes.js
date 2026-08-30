import { Router } from 'express';

// Route definitions only. OpenAPI documentation lives in
// `academic-structure.docs.js` (docs separated from routing logic).
export function createAcademicStructureRouter({ controller, middlewares, validators }) {
  const router = Router();

  router.use(middlewares.authenticate);

  router.get('/institutions/me', middlewares.authorizeAdmin, controller.getMyInstitution);

  router.patch(
    '/institutions/:institutionId',
    middlewares.authorizeAdmin,
    validators.institutionIdParam,
    validators.updateInstitution,
    controller.updateInstitution,
  );

  router.post(
    '/institutions/:institutionId/units',
    middlewares.authorizeAdmin,
    validators.institutionIdParam,
    validators.createUnit,
    controller.createUnit,
  );

  router.get(
    '/institutions/:institutionId/units',
    middlewares.authorizeStaff,
    validators.institutionIdParam,
    validators.listUnitsQuery,
    controller.listUnits,
  );

  router.patch(
    '/units/:unitId',
    middlewares.authorizeAdmin,
    validators.unitIdParam,
    validators.updateUnit,
    controller.updateUnit,
  );

  router.delete(
    '/units/:unitId',
    middlewares.authorizeAdmin,
    validators.unitIdParam,
    controller.deleteUnit,
  );

  return router;
}