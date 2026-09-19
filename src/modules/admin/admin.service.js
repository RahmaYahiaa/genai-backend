import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { ROLES } from '../../config/constants.js';
import { ADMIN_AUDIT_TYPES, OFFICER_PERMISSION_KEY_VALUES, OFFICER_TEMPLATES } from './admin.constants.js';

const ROLE_LABEL_AR = { student: 'طالب', instructor: 'دكتور', institution_admin: 'مسؤول' };

export function createAdminService({ adminRepository }) {
  async function permissionKeysOf(user) {
    if (user.role !== ROLES.INSTITUTION_ADMIN) return [];
    if (user.isSuperAdmin) return OFFICER_PERMISSION_KEY_VALUES;
    const row = await adminRepository.findByUserId(user.id);
    return row?.keys ?? [];
  }

  async function officerMe(user) {
    const keys = await permissionKeysOf(user);
    return { user, isSuperAdmin: user.isSuperAdmin === true, permissions: keys, templates: OFFICER_TEMPLATES };
  }

  async function logEvent(actor, type, scope, summary, detail = null) {
    await adminRepository.insertAuditEvent({
      institutionId: actor.institutionId,
      scope,
      type,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      summary,
      detail,
    });
  }

  async function requireTarget(userId, institutionId) {
    const target = await adminRepository.findUserInInstitution(userId, institutionId);
    if (!target) throw new NotFoundError('User not found in your institution');
    return target;
  }

  function fullName(u) {
    return `${u.firstName} ${u.lastName}`;
  }

  function assertMutableTarget(actor, target) {
    if (target.isSuperAdmin) throw new ForbiddenError('The super admin account cannot be modified');
    if (target.id === actor.id) throw new ForbiddenError('You cannot modify your own account from here');
  }

  async function listUsers(actor) {
    return adminRepository.listUsersByInstitution(actor.institutionId);
  }

  async function listOfficers(actor) {
    const users = await adminRepository.listUsersByInstitution(actor.institutionId);
    return users.filter((u) => u.role === ROLES.INSTITUTION_ADMIN);
  }

  async function setUserActive(actor, targetId, isActive) {
    const target = await requireTarget(targetId, actor.institutionId);
    assertMutableTarget(actor, target);
    await adminRepository.setUserActive(targetId, isActive);
    await logEvent(
      actor,
      isActive ? ADMIN_AUDIT_TYPES.USER_ACTIVATED : ADMIN_AUDIT_TYPES.USER_DEACTIVATED,
      'users.manage',
      isActive
        ? { en: `Activated ${fullName(target)}'s account — login restored`, ar: `تفعيل حساب ${fullName(target)} — عاد الدخول` }
        : { en: `Deactivated ${fullName(target)}'s account — login blocked immediately`, ar: `تعطيل حساب ${fullName(target)} — مُنع الدخول فورًا` },
    );
    return { ...target, isActive };
  }

  async function changeUserRole(actor, targetId, role) {
    const target = await requireTarget(targetId, actor.institutionId);
    assertMutableTarget(actor, target);
    if (target.role === role) return target;
    await adminRepository.setUserRole(targetId, role);
    if (target.role === ROLES.INSTITUTION_ADMIN && role !== ROLES.INSTITUTION_ADMIN) {
      await adminRepository.deleteForUser(targetId);
    }
    await logEvent(actor, ADMIN_AUDIT_TYPES.ROLE_CHANGED, 'users.manage', {
      en: `Changed ${fullName(target)}'s role to ${role}`,
      ar: `تغيير دور ${fullName(target)} إلى ${ROLE_LABEL_AR[role] ?? role}`,
    });
    return { ...target, role };
  }

  async function setAcademicNumber(actor, targetId, academicNumber) {
    const target = await requireTarget(targetId, actor.institutionId);
    await adminRepository.setAcademicNumber(targetId, academicNumber?.trim() || null);
    return { ...target, academicNumber: academicNumber?.trim() || null };
  }

  async function createOfficer(actor, { firstName, lastName, email, templateId, keys }) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await adminRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }
    const template = templateId && templateId !== 'custom' ? OFFICER_TEMPLATES.find((t) => t.id === templateId) : null;
    if (templateId && templateId !== 'custom' && !template) {
      throw new ValidationError('Unknown permission template');
    }
    const finalKeys = template ? template.keys : (keys ?? []);
    for (const key of finalKeys) {
      if (!OFFICER_PERMISSION_KEY_VALUES.includes(key)) throw new ValidationError(`Unknown permission key: ${key}`);
    }
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
    const created = await adminRepository.createUser({
      email: normalizedEmail,
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: ROLES.INSTITUTION_ADMIN,
      accountType: 'institutional',
      institutionId: actor.institutionId,
      isActive: false,
    });
    await adminRepository.upsertForUser({
      userId: created._id,
      institutionId: actor.institutionId,
      keys: finalKeys,
      updatedBy: actor.id,
    });
    await logEvent(actor, ADMIN_AUDIT_TYPES.OFFICER_ADDED, 'users.manage', {
      en: `Added officer ${firstName.trim()} ${lastName.trim()} with ${template ? `the ${template.name} template` : 'a custom scope set'} — invitation activates on self-registration`,
      ar: `إضافة المسؤول ${firstName.trim()} ${lastName.trim()} ${template ? `بقالب ${template.name}` : 'بنطاقات مخصصة'} — الدعوة تتفعل عند التسجيل الذاتي`,
    });
    return {
      id: created._id.toString(),
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
      role: created.role,
      isActive: created.isActive,
      isSuperAdmin: false,
      academicNumber: created.academicNumber ?? null,
      permissions: finalKeys,
      invited: true,
    };
  }

  async function setOfficerScopes(actor, targetId, keys) {
    const target = await requireTarget(targetId, actor.institutionId);
    if (target.role !== ROLES.INSTITUTION_ADMIN) throw new ValidationError('Scopes apply to officers only');
    if (target.isSuperAdmin) throw new ForbiddenError('The super admin implicitly holds every scope');
    for (const key of keys) {
      if (!OFFICER_PERMISSION_KEY_VALUES.includes(key)) throw new ValidationError(`Unknown permission key: ${key}`);
    }
    const row = await adminRepository.upsertForUser({ userId: targetId, institutionId: actor.institutionId, keys: [...new Set(keys)], updatedBy: actor.id });
    await logEvent(actor, ADMIN_AUDIT_TYPES.PERMISSIONS_CHANGED, 'users.manage', {
      en: `Set ${fullName(target)}'s scopes manually (${[...new Set(keys)].length} keys)`,
      ar: `تخصيص نطاقات ${fullName(target)} يدويًا (${[...new Set(keys)].length} مفاتيح)`,
    });
    return { ...target, permissions: row.keys };
  }

  async function applyOfficerTemplate(actor, targetId, templateId) {
    const template = OFFICER_TEMPLATES.find((t) => t.id === templateId);
    if (!template) throw new ValidationError('Unknown permission template');
    const result = await setOfficerScopes(actor, targetId, template.keys);
    await logEvent(actor, ADMIN_AUDIT_TYPES.PERMISSIONS_CHANGED, 'users.manage', {
      en: `Reassigned ${fullName(result)} to the ${template.name} template`,
      ar: `إعادة تعيين ${fullName(result)} إلى قالب ${template.name}`,
    });
    return result;
  }

  return {
    permissionKeysOf,
    officerMe,
    listUsers,
    listOfficers,
    setUserActive,
    changeUserRole,
    setAcademicNumber,
    createOfficer,
    setOfficerScopes,
    applyOfficerTemplate,
  };
}
