import { Router } from 'express';
import { OFFICER_PERMISSION_KEYS } from './admin.constants.js';

export function createAdminRouter({ controller, middlewares, guards, validators }) {
  const router = Router();

  router.get('/me', guards.authenticate, middlewares.requireInstitutionAdmin, controller.getMe);

  router.get('/users', guards.authenticate, middlewares.requirePermission(OFFICER_PERMISSION_KEYS.USERS_VIEW), controller.listUsers);
  router.patch('/users/:userId/active', guards.authenticate, middlewares.requirePermission(OFFICER_PERMISSION_KEYS.USERS_MANAGE), validators.userIdParam, validators.setActive, controller.setUserActive);
  router.patch('/users/:userId/role', guards.authenticate, middlewares.requirePermission(OFFICER_PERMISSION_KEYS.USERS_MANAGE), validators.userIdParam, validators.changeRole, controller.changeUserRole);
  router.patch('/users/:userId/academic-number', guards.authenticate, middlewares.requirePermission(OFFICER_PERMISSION_KEYS.USERS_MANAGE), validators.userIdParam, validators.academicNumber, controller.setAcademicNumber);

  router.get('/officers', guards.authenticate, middlewares.requireSuperAdmin, controller.listOfficers);
  router.post('/officers', guards.authenticate, middlewares.requireSuperAdmin, validators.createOfficer, controller.createOfficer);
  router.patch('/officers/:userId/template', guards.authenticate, middlewares.requireSuperAdmin, validators.userIdParam, validators.template, controller.applyOfficerTemplate);
  router.patch('/officers/:userId/scopes', guards.authenticate, middlewares.requireSuperAdmin, validators.userIdParam, validators.scopes, controller.setOfficerScopes);

  return router;
}
