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

  return {
    getMe,
    listUsers,
    listOfficers,
    setUserActive,
    changeUserRole,
    setAcademicNumber,
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
  };
}
