import { prisma } from '../../db/prisma.js';
import type { TxClient } from '../../db/transaction.js';
import type { Prisma } from '../../generated/prisma/client.js';

export const authRepository = {
  findUserByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  emailExists: async (tx: TxClient, email: string) =>
    (await tx.user.findUnique({ where: { email }, select: { id: true } })) !== null,

  createUser: (tx: TxClient, data: Prisma.UserCreateInput) => tx.user.create({ data }),

  createSession: (db: TxClient, data: Prisma.UserSessionUncheckedCreateInput) => db.userSession.create({ data }),

  createRefreshToken: (db: TxClient, data: Prisma.RefreshTokenUncheckedCreateInput) =>
    db.refreshToken.create({ data }),

  findSessionByUuid: (uuid: string) => prisma.userSession.findUnique({ where: { uuid }, include: { user: true } }),

  findRefreshToken: (tokenHash: string) =>
    prisma.refreshToken.findUnique({ where: { tokenHash }, include: { session: { include: { user: true } } } }),

  // Only revokes a token that is still active, so two racing refreshes can't both succeed.
  revokeRefreshToken: (id: number) =>
    prisma.refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }),

  revokeSession: (id: number) =>
    prisma.userSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }),

  revokeAllSessions: (userId: number) =>
    prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),

  findMemberships: (userId: number) =>
    prisma.membership.findMany({
      where: { userId },
      include: { org: { select: { uuid: true, name: true } } },
      orderBy: [{ createdAt: 'asc' }, { orgId: 'asc' }],
    }),
};
