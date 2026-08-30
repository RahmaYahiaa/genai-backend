import { ConflictError } from '../../shared/errors/index.js';

/**
 * Academic structure service. Owns every write to institution data so other
 * modules (e.g. auth tenant bootstrap) never touch the repository directly.
 */
export function createAcademicStructureService({ institutionRepository }) {
  async function createInstitution({ name, country, defaultLanguage }) {
    const nameKey = name.trim().toLowerCase();
    const existing = await institutionRepository.findByNameKey(nameKey);
    if (existing) {
      throw new ConflictError('An institution with this name already exists');
    }
    return institutionRepository.create({ name: name.trim(), nameKey, country, defaultLanguage });
  }

  async function deleteInstitution(institutionId) {
    return institutionRepository.deleteById(institutionId);
  }

  async function getInstitution(institutionId) {
    return institutionRepository.requireActiveById(institutionId);
  }

  return { createInstitution, deleteInstitution, getInstitution };
}