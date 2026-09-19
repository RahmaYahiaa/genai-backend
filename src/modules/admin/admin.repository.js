import OfficerPermissions from './officer-permissions.model.js';

export async function findByUserId(userId) {
  return OfficerPermissions.findOne({ userId }).lean();
}

export async function upsertForUser({ userId, institutionId, keys, updatedBy }) {
  return OfficerPermissions.findOneAndUpdate(
    { userId },
    { $set: { institutionId, keys, updatedBy: updatedBy ?? null } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}
