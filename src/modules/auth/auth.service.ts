import { ACTIVITY_TYPES } from '../../config/activity-types.js';
import { env } from '../../config/env.js';
import { ERROR_CODES } from '../../config/error-codes.js';
import { prisma } from '../../db/prisma.js';
import { withTransaction, type TxClient } from '../../db/transaction.js';
import { ActivityVisibility, MembershipRole, type User, type UserSession } from '../../generated/prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import type { ClientInfo } from '../../utils/request.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../../utils/token.js';
import { activityRepository } from '../activity/activity.repository.js';
import { organizationRepository } from '../organization/organization.repository.js';
import { organizationService } from '../organization/organization.service.js';
import { requestService } from '../request/request.service.js';
import { verificationService } from '../verification/verification.service.js';
import { authRepository } from './auth.repository.js';
import type { CompanyRegistrationInput, LoginInput } from './v1/auth.schema.js';

// Compared against when the email doesn't exist, so the response takes the same time either way.
const DUMMY_PASSWORD_HASH = await hashPassword('dummy-password-for-timing');

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_REFRESH_TOKEN = 'Invalid or expired refresh token';

export const isSessionActive = (session: UserSession) => !session.revokedAt && session.expiresAt > new Date();

export const isUserActive = (user: User) => !user.disabledAt;

const assertEmailAvailable = async (db: TxClient, email: string) => {
  if (await authRepository.emailExists(db, email)) {
    throw ApiError.conflict('An account with this email already exists', ERROR_CODES.EMAIL_TAKEN);
  }
};

const startSession = async (db: TxClient, user: User, client: ClientInfo) => {
  const session = await authRepository.createSession(db, {
    userId: user.id,
    ipAddress: client.ipAddress,
    userAgent: client.userAgent,
    expiresAt: new Date(Date.now() + env.SESSION_MAX_HOURS * 60 * 60 * 1000),
  });
  return issueTokens(db, user, session);
};

// Refresh tokens never outlive their session, so a login lasts at most SESSION_MAX_HOURS.
const issueTokens = async (db: TxClient, user: User, session: UserSession) => {
  const refreshToken = generateRefreshToken();
  await authRepository.createRefreshToken(db, {
    sessionId: session.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: session.expiresAt,
  });

  return {
    accessToken: signAccessToken({ sub: user.uuid, sid: session.uuid }),
    refreshToken,
  };
};

const buildSessionView = async (user: User) => {
  const memberships = await authRepository.findMemberships(user.id);

  return {
    user: {
      id: user.uuid,
      name: user.name,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      createdAt: user.createdAt,
    },
    memberships: memberships.map((m) => ({ orgId: m.org.uuid, role: m.role, createdAt: m.createdAt })),
    organizations: memberships.map((m) => ({ id: m.org.uuid, name: m.org.name })),
    activeOrgId: memberships[0]?.org.uuid ?? null,
  };
};

export const authService = {
  login: async ({ email, password }: LoginInput, client: ClientInfo) => {
    const user = await authRepository.findUserByEmail(email);
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches || !isUserActive(user)) {
      throw ApiError.unauthorized(INVALID_CREDENTIALS, ERROR_CODES.INVALID_CREDENTIALS);
    }

    const tokens = await startSession(prisma, user, client);
    return { ...tokens, session: await buildSessionView(user) };
  },

  refresh: async (refreshToken: string) => {
    const stored = await authRepository.findRefreshToken(hashToken(refreshToken));
    if (!stored) {
      throw ApiError.unauthorized(INVALID_REFRESH_TOKEN, ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    const { session } = stored;
    const { user } = session;

    // A refresh token used twice means it was copied, so log the user out of every device.
    if (stored.revokedAt) {
      await authRepository.revokeAllSessions(user.id);
      throw ApiError.unauthorized(INVALID_REFRESH_TOKEN, ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    if (!isSessionActive(session) || stored.expiresAt < new Date() || !isUserActive(user)) {
      throw ApiError.unauthorized(INVALID_REFRESH_TOKEN, ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    const { count } = await authRepository.revokeRefreshToken(stored.id);
    if (count === 0) {
      await authRepository.revokeAllSessions(user.id);
      throw ApiError.unauthorized(INVALID_REFRESH_TOKEN, ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    return issueTokens(prisma, user, session);
  },

  logout: async (sessionId: number) => {
    await authRepository.revokeSession(sessionId);
  },

  getSession: (user: User) => buildSessionView(user),

  // Account, company, owner membership, requests, events and session are created together or not at all.
  // Registration numbers are verified before the transaction so no DB connection waits on the external check.
  registerCompany: async (input: CompanyRegistrationInput, client: ClientInfo) => {
    const { contact, org, requirements, policyVersion } = input;
    await assertEmailAvailable(prisma, contact.email);
    const [passwordHash, verification] = await Promise.all([
      hashPassword(contact.password),
      verificationService.verifyRegistration(org.name, org.registration),
    ]);

    const result = await withTransaction(async (tx) => {
      await assertEmailAvailable(tx, contact.email);

      const user = await authRepository.createUser(tx, {
        name: contact.contactName,
        email: contact.email,
        passwordHash,
      });

      const { registration, ...profile } = org;
      const organization = await organizationRepository.create(tx, {
        ...profile,
        ...registration,
        ...verification,
        slug: await organizationService.uniqueSlug(tx, profile.name),
        createdById: user.id,
      });
      await organizationRepository.createMembership(tx, {
        orgId: organization.id,
        userId: user.id,
        role: MembershipRole.owner,
      });
      await activityRepository.create(tx, {
        actorId: user.id,
        orgId: organization.id,
        entityId: organization.uuid,
        type: ACTIVITY_TYPES.orgCreated,
        message: 'Company workspace created.',
        visibility: ActivityVisibility.public,
      });

      const requests = await requestService.createMany(tx, {
        orgId: organization.id,
        userId: user.id,
        requirements,
        policyVersion,
      });
      const tokens = await startSession(tx, user, client);

      return { user, organization, requests, tokens };
    });

    return {
      ...result.tokens,
      session: await buildSessionView(result.user),
      organization: organizationService.toCompanyProfile(result.organization),
      requests: result.requests.map(requestService.toRequestSummary),
    };
  },
};
