import AuditLog, { toPublicAuditLog } from './audit-log.model.js';

export async function create(data) {
  return AuditLog.create(data);
}

export async function listByCourse({ courseId, assignmentId, action, actorId, skip, limit }) {
  const filter = {
    courseId,
    ...(assignmentId ? { assignmentId } : {}),
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
  };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
}

export { toPublicAuditLog };