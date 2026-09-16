import * as auditLogRepository from './audit-log.repository.js';
import AuditLog, { toPublicAuditLog } from './audit-log.model.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { authService } from '../auth/index.js';
import { createAuditService } from './audit.service.js';
import { createAuditController } from './audit.controller.js';
import { createAuditRouter } from './audit.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  auditCourseIdParamSchema,
  auditListQuerySchema,
} from './audit.schema.js';

export { AuditLog as auditLogModel, toPublicAuditLog };
export { auditLogRepository };

export const auditService = createAuditService({
  auditLogRepository,
  coursesService,
  authService,
});

const controller = createAuditController({ auditService });

export const auditRouter = createAuditRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: auditCourseIdParamSchema }),
    listQuery: validateSchemas({ query: auditListQuerySchema }),
  },
});