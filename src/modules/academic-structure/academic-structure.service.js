import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { UNIT_TYPE_RANKS, toPublicUnit } from './academic-unit.model.js';
import { toPublicInstitution } from './institution.model.js';

/**
 * Normalizes institution email domains: lowercase, no leading "@", unique.
 * Stored bare ("zu.edu.eg") so matching compares against the email's domain part.
 */
function normalizeEmailDomains(domains) {
  if (!Array.isArray(domains)) return [];
  const cleaned = domains
    .map((domain) => domain.trim().toLowerCase().replace(/^@+/, ''))
    .filter((domain) => domain.length > 0);
  return [...new Set(cleaned)];
}

/**
 * Academic structure service. Owns every write to institution and academic
 * unit data so other modules (e.g. auth tenant bootstrap) never touch the
 * repositories directly.
 */
export function createAcademicStructureService({ institutionRepository, academicUnitRepository }) {
  // --- Institutions ---

  async function createInstitution({
    name,
    country,
    defaultLanguage,
    emailDomains,
    allowSelfRegistration,
  }) {
    const nameKey = name.trim().toLowerCase();
    const existing = await institutionRepository.findByNameKey(nameKey);
    if (existing) {
      throw new ConflictError('An institution with this name already exists');
    }

    const data = {
      name: name.trim(),
      nameKey,
      country,
      defaultLanguage,
      emailDomains: normalizeEmailDomains(emailDomains),
    };
    if (allowSelfRegistration !== undefined) {
      data.settings = { allowSelfRegistration };
    }
    return institutionRepository.create(data);
  }

  async function deleteInstitution(institutionId) {
    return institutionRepository.deleteById(institutionId);
  }

  async function getInstitution(institutionId) {
    return institutionRepository.requireActiveById(institutionId);
  }

  /** Admin-facing update of own institution profile and governance settings. */
  async function updateInstitution(caller, institutionId, patch) {
    // Scope guard: an admin may only update their own institution.
    if (!caller.institutionId || String(caller.institutionId) !== String(institutionId)) {
      throw new NotFoundError('Institution not found');
    }

    const institution = await institutionRepository.findById(institutionId);
    if (!institution) {
      throw new NotFoundError('Institution not found');
    }

    const update = {};
    if (patch.name !== undefined && patch.name.trim().toLowerCase() !== institution.nameKey) {
      const nameKey = patch.name.trim().toLowerCase();
      const existing = await institutionRepository.findByNameKey(nameKey);
      if (existing) {
        throw new ConflictError('An institution with this name already exists');
      }
      update.name = patch.name.trim();
      update.nameKey = nameKey;
    }
    if (patch.country !== undefined) update.country = patch.country;
    if (patch.defaultLanguage !== undefined) update.defaultLanguage = patch.defaultLanguage;
    if (patch.emailDomains !== undefined)
      update.emailDomains = normalizeEmailDomains(patch.emailDomains);
    if (patch.isActive !== undefined) update.isActive = patch.isActive;
    if (patch.allowSelfRegistration !== undefined) {
      update['settings.allowSelfRegistration'] = patch.allowSelfRegistration;
    }

    if (Object.keys(update).length === 0) {
      return toPublicInstitution(institution);
    }

    const updated = await institutionRepository.updateById(institutionId, { $set: update });
    return toPublicInstitution(updated);
  }

  // --- Academic units (faculty / department / program / semester) ---

  async function createUnit(admin, { type, name, code, parentId }) {
    const institutionId = admin.institutionId;

    let ancestors = [];
    if (parentId) {
      const parent = await academicUnitRepository.findById(parentId);
      if (!parent || String(parent.institutionId) !== String(institutionId)) {
        throw new NotFoundError('Parent unit not found');
      }
      if (UNIT_TYPE_RANKS[parent.type] >= UNIT_TYPE_RANKS[type]) {
        throw new ValidationError(
          `A ${type} cannot be nested under a ${parent.type}; follow the faculty > department > program > semester order`,
        );
      }
      ancestors = [
        ...(parent.ancestors ?? []).map((ancestor) => ({
          id: ancestor.id,
          type: ancestor.type,
          name: ancestor.name,
        })),
        { id: parent._id, type: parent.type, name: parent.name },
      ];
    }

    const unit = await academicUnitRepository.create({
      institutionId,
      type,
      name: name.trim(),
      code: code ?? null,
      parentId: parentId ?? null,
      ancestors,
    });
    return toPublicUnit(unit);
  }

  /** Loads a unit and asserts it belongs to the given institution scope. */
  async function getUnitInScope(unitId, institutionId) {
    const unit = await academicUnitRepository.findById(unitId);
    if (!unit || String(unit.institutionId) !== String(institutionId)) {
      throw new NotFoundError('Academic unit not found');
    }
    return unit;
  }

  async function listUnits(caller, institutionId, filters) {
    if (String(institutionId) !== String(caller.institutionId)) {
      throw new NotFoundError('Institution not found');
    }
    const units = await academicUnitRepository.listByInstitution(institutionId, filters);
    return units.map(toPublicUnit);
  }

  async function updateUnit(admin, unitId, patch) {
    await getUnitInScope(unitId, admin.institutionId);
    const update = {};
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.code !== undefined) update.code = patch.code;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;

    const updated = await academicUnitRepository.updateById(unitId, { $set: update });
    return toPublicUnit(updated);
  }

  async function deleteUnit(admin, unitId) {
    await getUnitInScope(unitId, admin.institutionId);
    const childCount = await academicUnitRepository.countChildren(unitId);
    if (childCount > 0) {
      throw new ConflictError('This unit has child units; delete or move them first');
    }
    return academicUnitRepository.deleteById(unitId);
  }

  return {
    createInstitution,
    deleteInstitution,
    getInstitution,
    updateInstitution,
    createUnit,
    getUnitInScope,
    listUnits,
    updateUnit,
    deleteUnit,
  };
}