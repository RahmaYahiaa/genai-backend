import bcrypt from 'bcryptjs';
import { config } from '../../config/index.js';
import { ROLES, ACCOUNT_TYPES } from '../../config/constants.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/index.js';
import { issueTokenPair, verifyRefreshToken } from './jwt.js';
import { toPublicUser } from './user.model.js';

const DUPLICATE_KEY_CODE = 11000;

function emailDomain(email) {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

function emailMatchesInstitutionDomains(email, emailDomains) {
  const domain = emailDomain(email);
  return emailDomains.some((allowed) => allowed.toLowerCase() === domain);
}

/**
 * Auth business logic. Dependencies are injected so the module can be wired
 * and tested explicitly from its composition root.
 */
export function createAuthService({ repository, institutionService }) {
  async function hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, config.jwt.bcryptRounds);
  }

  /**
   * Dual-track registration:
   * - institution_admin: bootstraps the tenant (name, email domains, policy).
   * - student without institutionId: individual learner (personal space).
   * - student with institutionId / instructor: institutional member; the
   *   institution must allow self-registration and (when email domains are
   *   configured) the email must be under one of its verified domains.
   */
  async function register({
    email,
    password,
    firstName,
    lastName,
    role,
    institutionId,
    institutionName,
    emailDomains,
    allowSelfRegistration,
    languagePreference,
  }) {
    // Belt-and-braces duplicate check (the unique index remains the
    // race-safe backstop for truly concurrent requests).
    const existingUser = await repository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    let createdInstitution = null;
    let effectiveInstitutionId = institutionId ?? null;
    let accountType;

    if (role === ROLES.INSTITUTION_ADMIN) {
      createdInstitution = await institutionService.createInstitution({
        name: institutionName,
        emailDomains,
        allowSelfRegistration,
      });
      effectiveInstitutionId = createdInstitution._id;
      accountType = ACCOUNT_TYPES.INSTITUTIONAL;
    } else if (role === ROLES.STUDENT && !effectiveInstitutionId) {
      // Individual learner track: no institution, personal learning space.
      accountType = ACCOUNT_TYPES.INDIVIDUAL;
    } else {
      const institution = await institutionService.getInstitution(effectiveInstitutionId);
      if (institution.settings?.allowSelfRegistration === false) {
        throw new ForbiddenError('This institution does not allow self-registration');
      }
      if (
        Array.isArray(institution.emailDomains) &&
        institution.emailDomains.length > 0 &&
        !emailMatchesInstitutionDomains(email, institution.emailDomains)
      ) {
        throw new ForbiddenError(
          'Registration for this institution requires an email under its verified domains',
        );
      }
      accountType = ACCOUNT_TYPES.INSTITUTIONAL;
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = await repository.create({
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        institutionId: effectiveInstitutionId,
        accountType,
        languagePreference,
      });

      return { user: toPublicUser(user), tokens: issueTokenPair(user) };
    } catch (error) {
      // Compensate a half-created tenant when user creation fails.
      if (createdInstitution) {
        await institutionService.deleteInstitution(createdInstitution._id);
      }
      if (error?.code === DUPLICATE_KEY_CODE && error?.keyValue?.email !== undefined) {
        throw new ConflictError('An account with this email already exists');
      }
      throw error;
    }
  }

  async function login({ email, password }) {
    const user = await repository.findByEmailWithCredentials(email);

    // Same generic error for unknown email and wrong password (no user enumeration).
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated');
    }

    await repository.updateById(user._id, { lastLoginAt: new Date() });
    const updatedUser = await repository.findById(user._id);
    return { user: toPublicUser(updatedUser), tokens: issueTokenPair(updatedUser) };
  }

  async function refresh({ refreshToken }) {
    const payload = verifyRefreshToken(refreshToken);
    const user = await repository.findByIdWithTokenVersion(payload.sub);

    if (!user) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    // A bumped tokenVersion (logout/revocation) invalidates old refresh tokens.
    if (payload.tv !== user.tokenVersion) {
      throw new UnauthorizedError('Session has been revoked, please login again');
    }
    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated');
    }

    return { user: toPublicUser(user), tokens: issueTokenPair(user) };
  }

  /** Revokes every token issued so far for the user (access and refresh). */
  async function logout(userId) {
    await repository.updateById(userId, { $inc: { tokenVersion: 1 } });
    return { loggedOut: true };
  }

  async function getProfile(userId) {
    const user = await repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toPublicUser(user);
  }

  async function updateProfile(userId, patch) {
    const update = { $set: patch };
    const user = await repository.updateById(userId, update);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toPublicUser(user);
  }

  return { register, login, refresh, logout, getProfile, updateProfile };
}