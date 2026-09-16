import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, buildPaginationMeta } from '../../shared/http/api-response.js';

export function createAuditController({ auditService }) {
  const listCourseAudit = asyncHandler(async (req, res) => {
    const result = await auditService.listCourseAudit(
      req.user,
      req.validated.params.courseId,
      req.validated.query,
    );
    sendSuccess(res, {
      data: result,
      meta: buildPaginationMeta({ page: result.page, limit: result.limit, total: result.total }),
    });
  });

  return { listCourseAudit };
}