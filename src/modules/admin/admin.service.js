import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { ROLES } from '../../config/constants.js';
import { ADMIN_AUDIT_TYPES, OFFICER_PERMISSION_KEY_VALUES, OFFICER_TEMPLATES } from './admin.constants.js';

const ROLE_LABEL_AR = { student: 'طالب', instructor: 'دكتور', institution_admin: 'مسؤول' };

export function createAdminService({ adminRepository, coursesService, enrollmentRequestRepository }) {
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

  function batchCounts(rows) {
    return {
      total: rows.length,
      newCount: rows.filter((r) => r.verdict === 'new').length,
      existingCount: rows.filter((r) => r.verdict === 'existing').length,
      errorCount: rows.filter((r) => r.verdict === 'error').length,
    };
  }

  async function stageImport(actor, { fileName, rows }) {
    const seen = new Set();
    const staged = [];
    for (let i = 0; i < rows.length; i += 1) {
      const raw = rows[i];
      const email = String(raw.email ?? '').trim().toLowerCase();
      const firstName = String(raw.firstName ?? '').trim();
      const lastName = String(raw.lastName ?? '').trim();
      const role = String(raw.role ?? '').trim().toLowerCase();
      const courseCodes = (Array.isArray(raw.courseCodes) ? raw.courseCodes : []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
      const base = { row: i + 2, firstName, lastName, email, role, courseCodes };
      if (!firstName || !lastName || !email || (role !== 'student' && role !== 'instructor')) {
        staged.push({ ...base, verdict: 'error', errorReason: { en: 'Missing required data or invalid role', ar: 'بيانات ناقصة أو دور غير صحيح' } });
        continue;
      }
      if (seen.has(email)) {
        staged.push({ ...base, verdict: 'error', errorReason: { en: 'Duplicated inside this same file', ar: 'مكرر داخل نفس الملف' } });
        continue;
      }
      seen.add(email);
      const existing = await adminRepository.findUserByEmail(email);
      staged.push({ ...base, verdict: existing ? 'existing' : 'new' });
    }
    const batch = await adminRepository.createBatch({
      institutionId: actor.institutionId,
      fileName: String(fileName).trim(),
      createdBy: actor.id,
      createdByName: `${actor.firstName} ${actor.lastName}`,
      rows: staged,
    });
    return { id: batch._id.toString(), fileName: batch.fileName, rows: batch.rows, counts: batchCounts(batch.rows), status: batch.status };
  }

  async function systemActor(institutionId) {
    const superAdmin = await adminRepository.findSuperAdminOfInstitution(institutionId);
    if (!superAdmin) throw new NotFoundError('The institution has no super admin');
    return {
      id: superAdmin._id.toString(),
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      role: superAdmin.role,
      accountType: superAdmin.accountType,
      institutionId: superAdmin.institutionId.toString(),
      isSuperAdmin: true,
      isActive: superAdmin.isActive,
    };
  }

  async function resolveCourseIds(institutionId, courseCodes) {
    if (!courseCodes.length) return [];
    const courses = await adminRepository.findCoursesByCodes(institutionId, courseCodes);
    const codes = new Set(courseCodes);
    return courses.filter((c) => codes.has(c.code)).map((c) => c._id);
  }

  async function enrollUserInCourseIds(actor, userId, courseIds) {
    let enrolled = 0;
    for (const courseId of courseIds) {
      try {
        await coursesService.enroll(actor, courseId.toString(), userId);
        enrolled += 1;
      } catch {
        continue;
      }
    }
    return enrolled;
  }

  async function confirmImport(actor, batchId) {
    const batch = await adminRepository.findBatch(actor.institutionId, batchId);
    if (!batch) throw new NotFoundError('Import batch not found');
    if (batch.status !== 'staged') throw new ValidationError('This batch has already been executed or discarded');
    const actorForEnrollment = await systemActor(actor.institutionId);
    let newCount = 0;
    let existingCount = 0;
    let errorCount = 0;
    for (const row of batch.rows) {
      if (row.verdict === 'error') {
        errorCount += 1;
        continue;
      }
      const courseIds = await resolveCourseIds(actor.institutionId, row.courseCodes);
      if (row.verdict === 'existing') {
        const user = await adminRepository.findUserByEmail(row.email);
        if (!user) {
          await adminRepository.insertInvitation({
            institutionId: actor.institutionId,
            batchId: batch._id,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            role: row.role,
            courseIds,
            status: 'pending',
          });
          newCount += 1;
          continue;
        }
        await enrollUserInCourseIds(actorForEnrollment, user._id.toString(), courseIds);
        await adminRepository.insertInvitation({
          institutionId: actor.institutionId,
          batchId: batch._id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role,
          courseIds,
          status: 'accepted',
          enrolledUserId: user._id,
          acceptedAt: new Date(),
        });
        existingCount += 1;
        continue;
      }
      await adminRepository.insertInvitation({
        institutionId: actor.institutionId,
        batchId: batch._id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        courseIds,
        status: 'pending',
      });
      newCount += 1;
    }
    await adminRepository.markBatchConfirmed(batch._id);
    await logEvent(actor, ADMIN_AUDIT_TYPES.BULK_IMPORTED, 'bulk.import', {
      en: `Bulk import ${batch.fileName} — ${newCount} invitations sent, ${existingCount} existing accounts enrolled directly, ${errorCount} rows rejected`,
      ar: `إدخال جماعي ${batch.fileName} — أُرسلت ${newCount} دعوة، وانضم ${existingCount} حساب قائم مباشرة، ورُفض ${errorCount} صف`,
    });
    return { id: batchId, newCount, existingCount, errorCount };
  }

  async function discardImport(actor, batchId) {
    const batch = await adminRepository.findBatch(actor.institutionId, batchId);
    if (!batch) throw new NotFoundError('Import batch not found');
    if (batch.status !== 'staged') throw new ValidationError('Only a staged, unconfirmed batch can be discarded');
    await adminRepository.deleteBatch(batch._id);
    return { id: batchId, discarded: true };
  }

  async function listImports(actor) {
    const batches = await adminRepository.listBatches(actor.institutionId);
    return batches.map((b) => ({
      id: b._id.toString(),
      fileName: b.fileName,
      createdByName: b.createdByName,
      createdAt: b.createdAt,
      confirmedAt: b.confirmedAt ?? null,
      status: b.status,
      rows: b.rows,
      counts: batchCounts(b.rows),
    }));
  }

  async function listInvitations(actor, status) {
    const invitations = await adminRepository.listInvitations(actor.institutionId, status);
    const now = Date.now();
    return invitations.map((inv) => ({
      id: inv._id.toString(),
      email: inv.email,
      firstName: inv.firstName,
      lastName: inv.lastName,
      role: inv.role,
      status: inv.status,
      sentAt: inv.createdAt,
      acceptedAt: inv.acceptedAt ?? null,
      waitingDays: inv.status === 'pending' ? Math.floor((now - new Date(inv.createdAt).getTime()) / 864e5) : 0,
    }));
  }

  async function acceptPendingInvitationsForUser(user) {
    const email = String(user.email ?? '').toLowerCase();
    if (!email) return 0;
    const pending = await adminRepository.findPendingInvitationsByEmail(email);
    let accepted = 0;
    for (const invitation of pending) {
      try {
        const actor = await systemActor(invitation.institutionId);
        await enrollUserInCourseIds(actor, (user._id ?? user.id).toString(), invitation.courseIds ?? []);
        await adminRepository.markInvitationAccepted(invitation._id, user._id ?? user.id);
        accepted += 1;
      } catch {
        continue;
      }
    }
    return accepted;
  }

  async function listEnrollmentRequests(actor, { status, page, limit }) {
    const skip = (page - 1) * limit;
    const { items, total } = await enrollmentRequestRepository.listByInstitution(actor.institutionId, { status, skip, limit });
    return { items: items.map(adminRepository.toPublicEnrollmentRequest), total, page, limit };
  }

  async function getRequestProof(actor, requestId) {
    const request = await adminRepository.findRequestProof(requestId, actor.institutionId);
    if (!request) throw new NotFoundError('Enrollment request not found');
    if (!request.proof?.data) throw new NotFoundError('This request has no proof attachment');
    return {
      fileName: request.proof.fileName,
      mimeType: request.proof.mimeType,
      size: request.proof.size ?? null,
      data: request.proof.data,
    };
  }

  async function decideEnrollmentRequest(actor, requestId, { decision, note }) {
    if (decision === 'REJECTED' && !note) {
      throw new ValidationError('A written reason is required when rejecting a request (سبب الرفض مطلوب عند رفض الطلب)');
    }
    const request = await adminRepository.findRequestInInstitution(requestId, actor.institutionId);
    if (!request) throw new NotFoundError('Enrollment request not found');
    const result = await coursesService.decideEnrollmentRequest(actor, requestId, { decision, note });
    const studentName = request.studentId?.firstName
      ? `${request.studentId.firstName} ${request.studentId.lastName}`
      : 'a student';
    const courseLabel = request.courseId?.code
      ? `${request.courseId.code} ${request.courseId.title}`
      : request.courseId?.title ?? 'a course';
    const approved = decision === 'APPROVED';
    await logEvent(
      actor,
      ADMIN_AUDIT_TYPES.REQUEST_DECIDED,
      'requests.review',
      {
        en: approved
          ? `Approved ${studentName}'s request to join ${courseLabel}${result.enrollmentCreated ? '' : ' (student was already enrolled)'}`
          : `Rejected ${studentName}'s request to join ${courseLabel} — reason: ${note}`,
        ar: approved
          ? `قَبِل طلب ${studentName} للانضمام إلى ${courseLabel}${result.enrollmentCreated ? '' : ' (الطالب مسجَّل بالفعل)'}`
          : `رفض طلب ${studentName} للانضمام إلى ${courseLabel} — السبب: ${note}`,
      },
      { requestId, decision },
    );
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
    stageImport,
    confirmImport,
    discardImport,
    listImports,
    listInvitations,
    acceptPendingInvitationsForUser,
    listEnrollmentRequests,
    getRequestProof,
    decideEnrollmentRequest,
  };
}
