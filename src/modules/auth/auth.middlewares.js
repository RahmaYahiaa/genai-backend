import { UnauthorizedError, ForbiddenError } from '../../shared/errors/index.js';
import { verifyAccessToken } from './jwt.js';
import * as authRepository from './auth.repository.js';
import { toPublicUser } from './user.model.js';

/**
 * Requires a valid, non-revoked access token. Loads the user from the database
 * on every request so role changes, deactivation, and logout take effect
 * immediately (no stale-claim authorization).
 */
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required: provide a bearer token');
    }

    const payload = verifyAccessToken(header.slice(7).trim());
    const user = await authRepository.findByIdWithTokenVersion(payload.sub);

    if (!user) {
      throw new UnauthorizedError('Account no longer exists');
    }
    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated');
    }
    if (payload.tv !== user.tokenVersion) {
      throw new UnauthorizedError('Session has been revoked, please login again');
    }

    req.user = toPublicUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role gate. Usage: `router.get('/x', authenticate, authorize('instructor'), handler)`.
 * Always preceded by `authenticate` in the chain.
 */
export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('Your role does not have access to this resource'));
      return;
    }
    next();
  };
}