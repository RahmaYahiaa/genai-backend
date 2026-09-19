import { ROLES } from '../../config/constants.js';
import { OFFICER_PERMISSION_KEY_VALUES, OFFICER_TEMPLATES } from './admin.constants.js';

// FR-ADM-01 — authority resolution: the super admin implicitly holds every
// key; an officer holds exactly the keys on his single permissions row; any
// other role holds nothing.
export function createAdminService({ adminRepository }) {
  async function permissionKeysOf(user) {
    if (user.role !== ROLES.INSTITUTION_ADMIN) {
      return [];
    }
    if (user.isSuperAdmin) {
      return OFFICER_PERMISSION_KEY_VALUES;
    }
    const row = await adminRepository.findByUserId(user.id);
    return row?.keys ?? [];
  }

  async function officerMe(user) {
    const keys = await permissionKeysOf(user);
    return {
      user,
      isSuperAdmin: user.isSuperAdmin === true,
      permissions: keys,
      templates: OFFICER_TEMPLATES,
    };
  }

  return { permissionKeysOf, officerMe };
}
