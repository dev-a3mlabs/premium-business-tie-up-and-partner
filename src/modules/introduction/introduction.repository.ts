import { prisma } from '../../db/prisma.js';
import type { TxClient } from '../../db/transaction.js';
import { IntroductionStatus, type Prisma } from '../../generated/prisma/client.js';
import { pageArgs } from '../../utils/pagination.js';

// Companies only ever see introductions that were sent; drafts stay internal.
const SENT_STATUSES = [IntroductionStatus.sent, IntroductionStatus.accepted, IntroductionStatus.declined];
const companyVisible = { status: { in: SENT_STATUSES }, discardedAt: null } satisfies Prisma.IntroductionWhereInput;

// An open introduction blocks drafting another one to the same specialist on the same request.
const OPEN_STATUSES = [IntroductionStatus.pending, IntroductionStatus.sent, IntroductionStatus.accepted];

const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
const WITH_REQUEST = { request: { select: { uuid: true, title: true } } } as const;

const adminRef = { select: { uuid: true, name: true } } as const;
export const ADMIN_INTRO_INCLUDE = {
  request: { select: { uuid: true, title: true, status: true, org: adminRef } },
  createdBy: adminRef,
  sentBy: adminRef,
  respondedBy: adminRef,
} as const;

export const introductionRepository = {
  findSentPageForOrg: (orgId: number, page: number) =>
    prisma.introduction.findMany({
      where: { ...companyVisible, request: { orgId } },
      include: WITH_REQUEST,
      orderBy: NEWEST_FIRST,
      ...pageArgs(page),
    }),

  countSentForOrg: (orgId: number) => prisma.introduction.count({ where: { ...companyVisible, request: { orgId } } }),

  countAcceptedForOrg: (orgId: number) =>
    prisma.introduction.count({
      where: { status: IntroductionStatus.accepted, discardedAt: null, request: { orgId } },
    }),

  findSentForRequest: (requestId: number, take: number) =>
    prisma.introduction.findMany({
      where: { ...companyVisible, requestId },
      include: WITH_REQUEST,
      orderBy: NEWEST_FIRST,
      take,
    }),

  findPendingForRequest: (requestId: number, tx: TxClient) =>
    tx.introduction.findMany({
      where: { requestId, status: IntroductionStatus.pending, discardedAt: null },
      select: { id: true, uuid: true },
    }),

  findOpenNamesForRequest: async (requestId: number, tx: TxClient) => {
    const rows = await tx.introduction.findMany({
      where: { requestId, status: { in: OPEN_STATUSES }, discardedAt: null },
      select: { specialistName: true },
    });
    return rows.map((row) => row.specialistName);
  },

  discard: (ids: number[], userId: number, tx: TxClient) =>
    tx.introduction.updateMany({
      where: { id: { in: ids }, discardedAt: null },
      data: { discardedAt: new Date(), discardedById: userId },
    }),

  create: (tx: TxClient, data: Prisma.IntroductionUncheckedCreateInput) => tx.introduction.create({ data }),

  update: (id: number, data: Prisma.IntroductionUncheckedUpdateInput, tx: TxClient) =>
    tx.introduction.update({ where: { id }, data }),

  findByUuid: (uuid: string, tx: TxClient = prisma) => tx.introduction.findUnique({ where: { uuid } }),

  findAdmin: (id: number, tx: TxClient = prisma) =>
    tx.introduction.findUniqueOrThrow({ where: { id }, include: ADMIN_INTRO_INCLUDE }),

  findAdminForRequest: (requestId: number, take: number) =>
    prisma.introduction.findMany({ where: { requestId }, include: ADMIN_INTRO_INCLUDE, orderBy: NEWEST_FIRST, take }),

  findAdminPage: (where: Prisma.IntroductionWhereInput, page: number) =>
    prisma.introduction.findMany({ where, include: ADMIN_INTRO_INCLUDE, orderBy: NEWEST_FIRST, ...pageArgs(page) }),

  count: (where: Prisma.IntroductionWhereInput) => prisma.introduction.count({ where }),
};
