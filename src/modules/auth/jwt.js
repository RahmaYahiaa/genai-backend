import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { TOKEN_TYPES } from '../../config/constants.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

const HS256 = ['HS256'];

function buildClaims(user, tokenType) {
  return {
    type: tokenType,
    role: user.role,
    // Null for individual learners (no institution).
    institutionId: user.institutionId ? user.institutionId.toString() : null,
    // Token version binds every token to the user's current session epoch.
    tv: user.tokenVersion ?? 0,
  };
}

export function signAccessToken(user) {
  return jwt.sign(buildClaims(user, TOKEN_TYPES.ACCESS), config.jwt.accessSecret, {
    subject: user._id.toString(),
    expiresIn: config.jwt.accessExpiresIn,
    algorithm: 'HS256',
  });
}

export function signRefreshToken(user) {
  return jwt.sign(buildClaims(user, TOKEN_TYPES.REFRESH), config.jwt.refreshSecret, {
    subject: user._id.toString(),
    expiresIn: config.jwt.refreshExpiresIn,
    algorithm: 'HS256',
  });
}

export function issueTokenPair(user) {
  return { accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) };
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret, { algorithms: HS256 });
    if (payload.type !== TOKEN_TYPES.ACCESS) {
      throw new UnauthorizedError('Invalid token type');
    }
    return payload;
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret, { algorithms: HS256 });
    if (payload.type !== TOKEN_TYPES.REFRESH) {
      throw new UnauthorizedError('Invalid token type');
    }
    return payload;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}