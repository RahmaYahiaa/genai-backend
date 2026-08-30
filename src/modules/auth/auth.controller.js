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

  return { register, login, refresh, logout, getProfile, updateProfile };
}