import { toPublicAuditLog } from './audit-log.model.js';

export function createAuditService({ auditLogRepository, coursesService, authService }) {
  async function record(entry) {
    return auditLogRepository.create(entry);
  }

  /**
   * Instructor/admin-only read of the course audit trail. Every row always
   * carries aiOriginalScore next to finalScore (when the action touched a
   * grade) and is enriched with the actor's display name.
   */
  async function listCourseAudit(user, courseId, query) {
    await coursesService.ensureInstructorCourseAccess(user, courseId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await auditLogRepository.listByCourse({
      courseId,
      assignmentId: query.assignmentId ?? null,
      action: query.action ?? null,
      actorId: null,
      from: query.from ?? null,
      to: query.to ?? null,
      skip: (page - 1) * limit,
      limit,
    });
    const actorIds = Array.from(new Set(items.map((item) => item.actorId.toString())));
    const profiles = actorIds.length > 0 ? await authService.getProfilesByIds(actorIds) : [];
    const nameById = new Map(
      profiles.map((profile) => [
        profile.id,
        `${profile.firstName} ${profile.lastName}`.trim(),
      ]),
    );
    return {
      items: items.map((item) => ({
        ...toPublicAuditLog(item),
        actorName: nameById.get(item.actorId.toString()) ?? 'Unknown actor',
      })),
      page,
      limit,
      total,
    };
  }

  return { record, listCourseAudit };
}