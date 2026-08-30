import Institution, { toPublicInstitution } from './institution.model.js';
import { NotFoundError } from '../../shared/errors/index.js';

export async function create(data) {
  return Institution.create(data);
}

export async function findByNameKey(nameKey) {
  return Institution.findOne({ nameKey }).lean();
}

export async function findById(institutionId) {
  return Institution.findById(institutionId).lean();
}

export async function updateById(institutionId, update) {
  return Institution.findByIdAndUpdate(institutionId, update, { new: true }).lean();
}

export async function deleteById(institutionId) {
  const result = await Institution.deleteOne({ _id: institutionId });
  return result.deletedCount > 0;
}

export async function requireActiveById(institutionId) {
  const institution = await findById(institutionId);
  if (!institution || !institution.isActive) {
    throw new NotFoundError('Institution not found or inactive');
  }
  return institution;
}

export { toPublicInstitution };