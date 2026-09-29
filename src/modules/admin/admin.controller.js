export function createAdminController({ adminService }) {
  async function getMe(req, res, next) {
    try {
      const payload = await adminService.officerMe(req.user);
      res.status(200).json({ success: true, data: payload });
    } catch (error) {
      next(error);
    }
  }

  async function listUsers(req, res, next) {
    try {
      const data = await adminService.listUsers(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function listOfficers(req, res, next) {
    try {
      const data = await adminService.listOfficers(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function setUserActive(req, res, next) {
    try {
      const data = await adminService.setUserActive(req.user, req.params.userId, req.body.isActive);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function changeUserRole(req, res, next) {
    try {
      const data = await adminService.changeUserRole(req.user, req.params.userId, req.body.role);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function setAcademicNumber(req, res, next) {
    try {
      const data = await adminService.setAcademicNumber(req.user, req.params.userId, req.body.academicNumber);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function setStudyYear(req, res, next) {
    try {
      const data = await adminService.setStudyYear(req.user, req.params.userId, req.body.studyYear);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function createOfficer(req, res, next) {
    try {
      const data = await adminService.createOfficer(req.user, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function applyOfficerTemplate(req, res, next) {
    try {
      const data = await adminService.applyOfficerTemplate(req.user, req.params.userId, req.body.templateId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function setOfficerScopes(req, res, next) {
    try {
      const data = await adminService.setOfficerScopes(req.user, req.params.userId, req.body.keys);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function stageImport(req, res, next) {
    try {
      const data = await adminService.stageImport(req.user, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function listImports(req, res, next) {
    try {
      const data = await adminService.listImports(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function confirmImport(req, res, next) {
    try {
      const data = await adminService.confirmImport(req.user, req.params.batchId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function discardImport(req, res, next) {
    try {
      const data = await adminService.discardImport(req.user, req.params.batchId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function listInvitations(req, res, next) {
    try {
      const data = await adminService.listInvitations(req.user, req.query.status);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function getProfile(req, res, next) {
    try {
      res.status(200).json({ success: true, data: await adminService.getProfile(req.user) });
    } catch (error) {
      next(error);
    }
  }

  async function updateProfile(req, res, next) {
    try {
      res.status(200).json({ success: true, data: await adminService.updateProfile(req.user, req.validated.body) });
    } catch (error) {
      next(error);
    }
  }

  async function previewInvitation(req, res, next) {
    try {
      const data = await adminService.previewInvitation(req.validated.params.token);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function acceptInvitation(req, res, next) {
    try {
      const data = await adminService.acceptInvitation(req.validated.params.token, req.validated.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function resendInvitation(req, res, next) {
    try {
      const data = await adminService.resendInvitation(req.user, req.validated.params.invitationId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function revokeInvitation(req, res, next) {
    try {
      const data = await adminService.revokeInvitation(req.user, req.validated.params.invitationId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function listRequests(req, res, next) {
    try {
      const { status, page, limit } = req.validated.query;
      const data = await adminService.listEnrollmentRequests(req.user, { status, page, limit });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function getRequestProof(req, res, next) {
    try {
      const data = await adminService.getRequestProof(req.user, req.validated.params.requestId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function decideRequest(req, res, next) {
    try {
      const data = await adminService.decideEnrollmentRequest(req.user, req.validated.params.requestId, req.validated.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function getSettings(req, res, next) {
    try {
      const data = await adminService.getSettings(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function updateSettings(req, res, next) {
    try {
      const data = await adminService.updateSettings(req.user, req.validated.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function listLinkCandidates(req, res, next) {
    try {
      const data = await adminService.listLinkCandidates(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function listLinkInvitations(req, res, next) {
    try {
      const data = await adminService.listLinkInvitations(req.user, req.validated.query.status);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function sendLinkInvitation(req, res, next) {
    try {
      const data = await adminService.sendLinkInvitation(req.user, req.validated.body.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function myLinkInvitations(req, res, next) {
    try {
      const data = await adminService.myLinkInvitations(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function respondLinkInvitation(req, res, next) {
    try {
      const data = await adminService.respondToLinkInvitation(
        req.user,
        req.validated.params.invitationId,
        req.validated.body.decision,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function listAuditEvents(req, res, next) {
    try {
      const data = await adminService.listAuditEvents(req.user, req.validated.query);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function getHealth(req, res, next) {
    try {
      const data = await adminService.getInstitutionHealth(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async function getAnalytics(req, res, next) {
    try {
      const data = await adminService.getAnalyticsSnapshot(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  return {
    getProfile,
    updateProfile,
    previewInvitation,
    acceptInvitation,
    resendInvitation,
    revokeInvitation,
    getMe,
    listUsers,
    listOfficers,
    setUserActive,
    changeUserRole,
    setAcademicNumber,
    setStudyYear,
    createOfficer,
    applyOfficerTemplate,
    setOfficerScopes,
    stageImport,
    listImports,
    confirmImport,
    discardImport,
    listInvitations,
    listRequests,
    getRequestProof,
    decideRequest,
    getSettings,
    updateSettings,
    listLinkCandidates,
    listLinkInvitations,
    sendLinkInvitation,
    myLinkInvitations,
    respondLinkInvitation,
    listAuditEvents,
    getHealth,
    getAnalytics,
  };
}
