import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated } from '../../shared/http/api-response.js';

export function createAuthController({ authService }) {
  const register = asyncHandler(async (req, res) => {
    const result = await authService.register(req.validated.body);
    sendCreated(res, result);
  });

  const login = asyncHandler(async (req, res) => {
    const result = await authService.login(req.validated.body);
    sendSuccess(res, { data: result });
  });

  const refresh = asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.validated.body);
    sendSuccess(res, { data: result });
  });

  const registrationGuidance = asyncHandler(async (req, res) => {
    const result = await authService.getRegistrationGuidance(req.validated.query.email);
    sendSuccess(res, { data: result });
  });

  const logout = asyncHandler(async (req, res) => {
    const result = await authService.logout(req.user.id);
    sendSuccess(res, { data: result });
  });

  const getProfile = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: req.user });
  });

  const updateProfile = asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user.id, req.validated.body);
    sendSuccess(res, { data: user });
  });

  const verifyEmail = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await authService.verifyEmail(req.user.id, req.validated.body) });
  });

  const resendVerification = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await authService.resendVerification(req.user.id) });
  });

  const forgotPassword = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await authService.forgotPassword(req.validated.body) });
  });

  const resetPassword = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await authService.resetPassword(req.validated.body) });
  });

  return {
    register,
    login,
    refresh,
    registrationGuidance,
    logout,
    getProfile,
    updateProfile,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
  };
}