import OfficerPermissions from './officer-permissions.model.js';
import * as adminRepository from './admin.repository.js';
import { authenticate } from '../auth/index.js';
import { createAdminService } from './admin.service.js';
import { createAdminMiddlewares } from './admin.middlewares.js';
import { createAdminController } from './admin.controller.js';
import { createAdminRouter } from './admin.routes.js';

export { OfficerPermissions as officerPermissionsModel };
export { adminRepository };

// Composition root (manual DI), mirroring the other modules.
export const adminService = createAdminService({ adminRepository });
const middlewares = createAdminMiddlewares({ adminService });
const controller = createAdminController({ adminService });

export const adminRouter = createAdminRouter({
  controller,
  middlewares,
  guards: { authenticate },
});
