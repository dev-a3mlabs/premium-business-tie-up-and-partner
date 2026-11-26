import { prisma } from '../../db/prisma.js';
import type { TxClient } from '../../db/transaction.js';
import type { MembershipRole, Prisma } from '../../generated/prisma/client.js';
import { pageArgs } from '../../utils/pagination.js';

export const organizationRepository = {
  findSlugsStartingWith: async (tx: TxClient, base: string) => {
    const rows = await tx.organization.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
    return rows.map((row) => row.slug);
  },

  create: (tx: TxClient, data: Prisma.OrganizationUncheckedCreateInput) => tx.organization.create({ data }),

  update: (id: number, data: Prisma.OrganizationUpdateInput, tx: TxClient = prisma) =>
    tx.organization.update({ where: { id }, data }),

  createMembership: (tx: TxClient, data: { orgId: number; userId: number; role: MembershipRole }) =>
    tx.membership.create({ data }),

  findPageWithCounts: (page: number) =>
    prisma.organization.findMany({
      include: { _count: { select: { requests: true, memberships: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(page),
    }),

  count: () => prisma.organization.count(),
};
