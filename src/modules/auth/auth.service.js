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

function isContractGatedUser(user) {
  return (
    user.accountType === ACCOUNT_TYPES.INSTITUTIONAL &&
    user.role !== ROLES.INSTITUTION_ADMIN &&
    Boolean(user.institutionId)
  );
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
      // A university email can never become a personal account: if the domain
      // belongs to a registered institution the registrar is redirected to
      // the institutional track (contract active) or to a personal email
      // (contract suspended).
      const domainInstitution = await institutionService.findInstitutionByEmailDomain(
        emailDomain(email),
      );
      if (domainInstitution) {
        if (domainInstitution.isActive) {
          throw new ForbiddenError(
            `This email belongs to ${domainInstitution.name} - students of a contracted university register through their institution, not a personal account`,
          );
        }
        throw new ForbiddenError(
          `Your university (${domainInstitution.name}) is not contracted with the platform - register with a personal email instead`,
        );
      }
      accountType = ACCOUNT_TYPES.INDIVIDUAL;
    } else {
      const institution = await institutionService.getInstitutionOrNull(effectiveInstitutionId);
      if (!institution) {
        throw new NotFoundError('Institution not found');
      }
      if (!institution.isActive) {
        throw new ForbiddenError('Your university is not contracted with the platform');
      }
      if (
        !Array.isArray(institution.emailDomains) ||
        institution.emailDomains.length === 0
      ) {
        throw new ForbiddenError(
          'Institution registration requires verified email domains - ask your institution admin to configure them',
        );
      }
      if (institution.settings?.allowSelfRegistration === false) {
        throw new ForbiddenError('This institution does not allow self-registration');
      }
      if (
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
    if (isContractGatedUser(user)) {
      const institution = await institutionService.getInstitutionOrNull(user.institutionId);
      if (!institution || !institution.isActive) {
        throw new ForbiddenError(
          'Your university is not currently contracted with the platform - contact your institution admin',
        );
      }
    }

    await repository.updateById(user._id, { lastLoginAt: new Date() });
    // tokenVersion is select:false, so the plain findById lookup would mint
    // tokens with a stale tv claim (breaking refresh and every guarded call
    // after a logout->login cycle).
    const updatedUser = await repository.findByIdWithTokenVersion(user._id);
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
    if (isContractGatedUser(user)) {
      const institution = await institutionService.getInstitutionOrNull(user.institutionId);
      if (!institution || !institution.isActive) {
        throw new ForbiddenError(
          'Your university is not currently contracted with the platform - contact your institution admin',
        );
      }
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

  async function getProfilesByIds(userIds) {
    const users = await repository.findByIds(userIds);
    return users.map(toPublicUser);
  }

  async function updateProfile(userId, patch) {
    const update = { $set: patch };
    const user = await repository.updateById(userId, update);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toPublicUser(user);
  }

  /**
   * Public pre-registration check: resolves the email domain to a registered
   * institution so the client can route the user into the right track. A
   * contracted university email must go through the institutional track; a
   * suspended one is told to fall back to a personal email.
   */
  async function getRegistrationGuidance(email) {
    const domain = emailDomain(email);
    const institution = await institutionService.findInstitutionByEmailDomain(domain);
    if (!institution) {
      return {
        emailDomain: domain,
        institution: null,
        canUseUniversityEmail: true,
        recommendedTrack: 'personal',
        message: 'No university is registered under this email domain - continue with a personal account',
      };
    }
    if (institution.isActive) {
      return {
        emailDomain: domain,
        institution: { id: institution.id, name: institution.name, contractActive: true },
        canUseUniversityEmail: true,
        recommendedTrack: 'institutional',
        message: `This email belongs to ${institution.name} - select it as your institution and register through the university track`,
      };
    }
    return {
      emailDomain: domain,
      institution: { id: institution.id, name: institution.name, contractActive: false },
      canUseUniversityEmail: false,
      recommendedTrack: 'personal',
      message: `${institution.name} is not contracted with the platform - register with a personal email instead`,
    };
  }

  return { register, login, refresh, logout, getProfile, getProfilesByIds, updateProfile, getRegistrationGuidance };
}