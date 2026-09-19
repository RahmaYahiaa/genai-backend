// Thin HTTP layer; permission logic lives in the service/middlewares.
export function createAdminController({ adminService }) {
  // GET /me — the admin shell's bootstrap: who am I, which keys do I hold,
  // and which templates exist for assignment.
  async function getMe(req, res, next) {
    try {
      const payload = await adminService.officerMe(req.user);
      res.status(200).json({ success: true, data: payload });
    } catch (error) {
      next(error);
    }
  }

  return { getMe };
}
