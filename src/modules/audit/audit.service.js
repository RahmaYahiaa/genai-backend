export function createAuditService({ auditLogRepository }) {
  async function record(entry) {
    return auditLogRepository.create(entry);
  }

  async function listByCourse(query) {
    return auditLogRepository.listByCourse(query);
  }

  return { record, listByCourse };
}