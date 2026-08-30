import Institution from './institution.model.js';
import * as institutionRepository from './institution.repository.js';
import AcademicUnit from './academic-unit.model.js';
import * as academicUnitRepository from './academic-unit.repository.js';
import { authenticate, authorize } from '../auth/index.js';
import { createAcademicStructureService } from './academic-structure.service.js';
import { createAcademicStructureController } from './academic-structure.controller.js';
import { createAcademicStructureRouter } from './academic-structure.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  institutionIdParamSchema,
  updateInstitutionSchema,
  createUnitSchema,
  listUnitsQuerySchema,
  unitIdParamSchema,
  updateUnitSchema,
} from './academic-structure.schema.js';

export { Institution as institutionModel };
export { institutionRepository };
export { AcademicUnit as academicUnitModel };
export { academicUnitRepository };

// Composition root (manual DI): repositories -> service -> controller -> router.
export const academicStructureService = createAcademicStructureService({
  institutionRepository,
  academicUnitRepository,
});

const controller = createAcademicStructureController({ academicStructureService });

export const academicStructureRouter = createAcademicStructureRouter({
  controller,
  middlewares: {
    authenticate,
    authorizeAdmin: authorize('institution_admin'),
    // Instructors may read the academic structure of their own institution.
    authorizeStaff: authorize('institution_admin', 'instructor'),
  },
  validators: {
    institutionIdParam: validateSchemas({ params: institutionIdParamSchema }),
    updateInstitution: validateSchemas({ body: updateInstitutionSchema }),
    createUnit: validateSchemas({ body: createUnitSchema }),
    listUnitsQuery: validateSchemas({ query: listUnitsQuerySchema }),
    unitIdParam: validateSchemas({ params: unitIdParamSchema }),
    updateUnit: validateSchemas({ body: updateUnitSchema }),
  },
});