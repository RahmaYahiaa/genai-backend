import User from '../auth/user.model.js';
import { ROLES } from '../../config/constants.js';
import OfficerPermissions from './officer-permissions.model.js';
import AdminAuditEvent from './admin-audit-event.model.js';

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

export async function deleteForUser(userId) {
  await OfficerPermissions.deleteOne({ userId });
}

export async function findUserByEmail(email) {
  return User.findOne({ email }).lean();
}

export async function listUsersByInstitution(institutionId) {
  const users = await User.find({ institutionId }).sort({ createdAt: 1 }).lean();
  const officerIds = users.filter((u) => u.role === ROLES.INSTITUTION_ADMIN).map((u) => u._id);
  const rows = await OfficerPermissions.find({ userId: { $in: officerIds } }).lean();
  const keysByUser = new Map(rows.map((row) => [row.userId.toString(), row.keys]));
  return users.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    accountType: u.accountType,
    institutionId: u.institutionId.toString(),
    isActive: u.isActive,
    isSuperAdmin: u.isSuperAdmin === true,
    academicNumber: u.academicNumber ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    invited: u.isActive === false && !u.lastLoginAt,
    permissions: keysByUser.get(u._id.toString()) ?? [],
  }));
}

export async function findUserInInstitution(userId, institutionId) {
  const u = await User.findOne({ _id: userId, institutionId }).lean();
  if (!u) return null;
  return {
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isActive: u.isActive,
    isSuperAdmin: u.isSuperAdmin === true,
    institutionId: u.institutionId.toString(),
  };
}

export async function setUserActive(userId, isActive) {
  await User.updateOne({ _id: userId }, { $set: { isActive } });
}

export async function setUserRole(userId, role) {
  await User.updateOne({ _id: userId }, { $set: { role } });
}

export async function setAcademicNumber(userId, academicNumber) {
  await User.updateOne({ _id: userId }, { $set: { academicNumber } });
}

export async function createUser(doc) {
  const user = await User.create(doc);
  return user.toObject();
}

export async function insertAuditEvent(doc) {
  const event = await AdminAuditEvent.create(doc);
  return event.toObject();
}
