import OfficerPermissions from './officer-permissions.model.js';
import AdminAuditEvent from './admin-audit-event.model.js';
import Invitation from './invitation.model.js';
import ImportBatch from './import-batch.model.js';
import AccountLinkInvitation from './account-link-invitation.model.js';
import * as adminRepository from './admin.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService, enrollmentRequestRepository } from '../courses/index.js';
import { createAdminService } from './admin.service.js';
import { createAdminMiddlewares } from './admin.middlewares.js';
import { createAdminController } from './admin.controller.js';
import { createAdminRouter, createLinkConsentRouter } from './admin.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import { adminSchemas } from './admin.schema.js';

export {
  OfficerPermissions as officerPermissionsModel,
  AdminAuditEvent as adminAuditEventModel,
  Invitation as invitationModel,
  ImportBatch as importBatchModel,
  AccountLinkInvitation as accountLinkInvitationModel,
};
export { adminRepository };

export const adminService = createAdminService({ adminRepository, coursesService, enrollmentRequestRepository });
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
    stageImport: validateSchemas({ body: adminSchemas.stageImport }),
    batchIdParam: validateSchemas({ params: adminSchemas.batchIdParam }),
    invitationsQuery: validateSchemas({ query: adminSchemas.invitationsQuery }),
    requestsQuery: validateSchemas({ query: adminSchemas.requestsQuery }),
    requestIdParam: validateSchemas({ params: adminSchemas.requestIdParam }),
    decideRequest: validateSchemas({ body: adminSchemas.decideRequest }),
    settingsPatch: validateSchemas({ body: adminSchemas.settingsPatch }),
    sendLinkInvitation: validateSchemas({ body: adminSchemas.sendLinkInvitation }),
    linkInvitationsQuery: validateSchemas({ query: adminSchemas.linkInvitationsQuery }),
    invitationIdParam: validateSchemas({ params: adminSchemas.invitationIdParam }),
    linkRespond: validateSchemas({ body: adminSchemas.linkRespond }),
    auditQuery: validateSchemas({ query: adminSchemas.auditQuery }),
  },
});

export const linkConsentRouter = createLinkConsentRouter({
  controller,
  guards: { authenticate },
  validators: {
    invitationIdParam: validateSchemas({ params: adminSchemas.invitationIdParam }),
    linkRespond: validateSchemas({ body: adminSchemas.linkRespond }),
  },
});
