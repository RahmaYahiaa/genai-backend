import { ForbiddenError } from '../../shared/errors/index.js';
import { ROLES } from '../../config/constants.js';

// FR-ADM-01 gates. Always preceded by `authenticate` in the chain.
export function createAdminMiddlewares({ adminService }) {
  // Any institution admin (even an officer holding zero keys yet).
  function requireInstitutionAdmin(req, _res, next) {
    if (req.user?.role !== ROLES.INSTITUTION_ADMIN) {
      next(new ForbiddenError('This area is reserved for institution administration'));
      return;
    }
    next();
  }

  // Only the tenant's super admin may manage officers and their scopes.
  function requireSuperAdmin(req, _res, next) {
    if (req.user?.role !== ROLES.INSTITUTION_ADMIN || req.user.isSuperAdmin !== true) {
      next(new ForbiddenError('Only the super admin can manage officers and permission scopes'));
      return;
    }
    next();
  }

  // Officer-scope gate: super admin bypasses; an officer must hold the key.
  function requirePermission(key) {
    return async (req, _res, next) => {
      try {
        if (req.user?.role !== ROLES.INSTITUTION_ADMIN) {
          throw new ForbiddenError('This area is reserved for institution administration');
        }
        if (req.user.isSuperAdmin === true) {
          next();
          return;
        }
        const keys = await adminService.permissionKeysOf(req.user);
        if (!keys.includes(key)) {
          throw new ForbiddenError('This action lies outside your permission scope');
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  return { requireInstitutionAdmin, requireSuperAdmin, requirePermission };
}
