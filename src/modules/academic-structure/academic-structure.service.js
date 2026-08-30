import { ConflictError } from '../../shared/errors/index.js';

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
 * Academic structure service. Owns every write to institution data so other
 * modules (e.g. auth tenant bootstrap) never touch the repository directly.
 */
export function createAcademicStructureService({ institutionRepository }) {
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

  return { createInstitution, deleteInstitution, getInstitution };
}