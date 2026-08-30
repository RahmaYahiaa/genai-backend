import Material, { toPublicMaterial } from './material.model.js';

export async function create(data) {
  return Material.create(data);
}

export async function findById(materialId) {
  return Material.findById(materialId).lean();
}

export async function listByCourse(courseId, { skip, limit }) {
  const [items, total] = await Promise.all([
    Material.find({ courseId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Material.countDocuments({ courseId }),
  ]);
  return { items, total };
}

export async function updateById(materialId, update) {
  return Material.findByIdAndUpdate(materialId, update, { new: true }).lean();
}

export async function deleteById(materialId) {
  const result = await Material.deleteOne({ _id: materialId });
  return result.deletedCount > 0;
}

export { toPublicMaterial };