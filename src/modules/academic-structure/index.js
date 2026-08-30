import Institution from './institution.model.js';
import * as institutionRepository from './institution.repository.js';
import { createAcademicStructureService } from './academic-structure.service.js';

export { Institution as institutionModel };
export { institutionRepository };

// Composition root for this module's service (manual DI).
export const academicStructureService = createAcademicStructureService({
  institutionRepository,
});