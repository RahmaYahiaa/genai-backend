import User from '../auth/user.model.js';
import { ROLES, ACCOUNT_TYPES } from '../../config/constants.js';
import OfficerPermissions from './officer-permissions.model.js';
import AdminAuditEvent from './admin-audit-event.model.js';
import Invitation from './invitation.model.js';
import ImportBatch from './import-batch.model.js';
import AccountLinkInvitation from './account-link-invitation.model.js';
import Institution from '../academic-structure/institution.model.js';
import Course from '../courses/course.model.js';
import EnrollmentRequest, { toPublicEnrollmentRequest } from '../courses/enrollment-request.model.js';

export { toPublicEnrollmentRequest };

export async function findRequestInInstitution(requestId, institutionId) {
  return EnrollmentRequest.findOne({ _id: requestId, institutionId })
    .populate('studentId', 'firstName lastName email academicNumber')
    .populate('courseId', 'title code')
    .lean();
}

export async function findRequestProof(requestId, institutionId) {
  return EnrollmentRequest.findOne({ _id: requestId, institutionId })
    .select('+proof.data')
    .lean();
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findInstitutionById(institutionId) {
  return Institution.findById(institutionId).lean();
}

export async function updateInstitutionSettings(institutionId, set) {
  return Institution.findByIdAndUpdate(institutionId, { $set: set }, { new: true }).lean();
}

export async function listLinkCandidateUsers(emailDomains) {
  if (!Array.isArray(emailDomains) || emailDomains.length === 0) return [];
  const matchers = emailDomains.map((domain) => ({
    email: new RegExp(`@${escapeRegExp(String(domain).toLowerCase())}$`, 'i'),
  }));
  return User.find({ accountType: ACCOUNT_TYPES.INDIVIDUAL, $or: matchers })
    .select('firstName lastName email accountType createdAt')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}

export async function findUserById(userId) {
  return User.findById(userId).lean();
}

export async function findLinkInvitation(institutionId, userId) {
  return AccountLinkInvitation.findOne({ institutionId, userId }).lean();
}

export async function findLinkInvitationById(invitationId) {
  return AccountLinkInvitation.findById(invitationId).populate('institutionId', 'name').lean();
}

export async function listLinkInvitations(institutionId, status) {
  const filter = { institutionId, ...(status ? { status } : {}) };
  return AccountLinkInvitation.find(filter)
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
}

export async function createLinkInvitation(data) {
  return AccountLinkInvitation.create(data);
}

export async function resetLinkInvitation(invitationId, { invitedById, invitedByName }) {
  return AccountLinkInvitation.findByIdAndUpdate(
    invitationId,
    { $set: { status: 'awaiting-consent', invitedById, invitedByName, respondedAt: null } },
    { new: true },
  ).lean();
}

export async function markInvitationResponded(invitationId, status) {
  return AccountLinkInvitation.findByIdAndUpdate(
    invitationId,
    { $set: { status, respondedAt: new Date() } },
    { new: true },
  ).lean();
}

export async function findMyPendingLinkInvitations(userId) {
  return AccountLinkInvitation.find({ userId, status: 'awaiting-consent' })
    .populate('institutionId', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

export async function linkUserToInstitution(userId, institutionId) {
  return User.findByIdAndUpdate(
    userId,
    { $set: { institutionId, accountType: ACCOUNT_TYPES.INSTITUTIONAL } },
    { new: true },
  ).lean();
}

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

export async function createBatch(doc) {
  const batch = await ImportBatch.create(doc);
  return batch.toObject();
}

export async function findBatch(institutionId, batchId) {
  return ImportBatch.findOne({ _id: batchId, institutionId }).lean();
}

export async function listBatches(institutionId) {
  return ImportBatch.find({ institutionId, status: { $ne: 'discarded' } }).sort({ createdAt: -1 }).lean();
}

export async function markBatchConfirmed(batchId) {
  await ImportBatch.updateOne({ _id: batchId }, { $set: { status: 'confirmed', confirmedAt: new Date() } });
}

export async function deleteBatch(batchId) {
  await ImportBatch.deleteOne({ _id: batchId, status: 'staged' });
}

export async function listInvitations(institutionId, status) {
  const filter = { institutionId };
  if (status) filter.status = status;
  return Invitation.find(filter).sort({ createdAt: -1 }).lean();
}

export async function insertInvitation(doc) {
  const invitation = await Invitation.create(doc);
  return invitation.toObject();
}

export async function findPendingInvitationsByEmail(email) {
  return Invitation.find({ email: email.toLowerCase(), status: 'pending' }).lean();
}

export async function markInvitationAccepted(invitationId, userId) {
  await Invitation.updateOne(
    { _id: invitationId },
    { $set: { status: 'accepted', acceptedAt: new Date(), enrolledUserId: userId } },
  );
}

export async function findCoursesByCodes(institutionId, codes) {
  return Course.find({ institutionId, code: { $in: codes.map((c) => c.toUpperCase()) } }).lean();
}

export async function findSuperAdminOfInstitution(institutionId) {
  return User.findOne({ institutionId, role: ROLES.INSTITUTION_ADMIN, isSuperAdmin: true }).lean();
}
