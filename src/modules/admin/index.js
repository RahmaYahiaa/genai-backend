import OfficerPermissions from './officer-permissions.model.js';
import AdminAuditEvent from './admin-audit-event.model.js';
import * as adminRepository from './admin.repository.js';
import { authenticate } from '../auth/index.js';
import { createAdminService } from './admin.service.js';
import { createAdminMiddlewares } from './admin.middlewares.js';
import { createAdminController } from './admin.controller.js';
import { createAdminRouter } from './admin.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import { adminSchemas } from './admin.schema.js';

export { OfficerPermissions as officerPermissionsModel, AdminAuditEvent as adminAuditEventModel };
export { adminRepository };

export const adminService = createAdminService({ adminRepository });
const middlewares = createAdminMiddlewares({ adminService });
const controller = createAdminController({ adminService });

export const adminRouter = createAdminRouter({
  controller,
  middlewares,
  guards: { authenticate },
  validators: {
    userIdParam: validateSchemas({ params: adminSchemas.userIdParam }),
    setActive: validateSchemas({ body: adminSchemas.setActive }),
    changeRole: validateSchemas({ body: adminSchemas.changeRole }),
    academicNumber: validateSchemas({ body: adminSchemas.academicNumber }),
    createOfficer: validateSchemas({ body: adminSchemas.createOfficer }),
    template: validateSchemas({ body: adminSchemas.template }),
    scopes: validateSchemas({ body: adminSchemas.scopes }),
  },
});
