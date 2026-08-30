import AcademicUnit, { toPublicUnit } from './academic-unit.model.js';

export async function create(data) {
  return AcademicUnit.create(data);
}

export async function findById(unitId) {
  return AcademicUnit.findById(unitId).lean();
}

export async function listByInstitution(institutionId, { type, parentId } = {}) {
  const filter = { institutionId };
  if (type) filter.type = type;
  if (parentId) filter.parentId = parentId;
  return AcademicUnit.find(filter).sort({ type: 1, name: 1 }).lean();
}

export async function countChildren(parentId) {
  return AcademicUnit.countDocuments({ parentId });
}

export async function updateById(unitId, update) {
  return AcademicUnit.findByIdAndUpdate(unitId, update, { new: true }).lean();
}

export async function deleteById(unitId) {
  const result = await AcademicUnit.deleteOne({ _id: unitId });
  return result.deletedCount > 0;
}

export { toPublicUnit };