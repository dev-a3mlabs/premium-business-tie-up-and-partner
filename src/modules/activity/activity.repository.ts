import { ACTIVITY_TYPES } from '../../config/activity-types.js';
import { prisma } from '../../db/prisma.js';
import type { TxClient } from '../../db/transaction.js';
import { ActivityVisibility, type Prisma } from '../../generated/prisma/client.js';
import { pageArgs } from '../../utils/pagination.js';

const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
const WITH_REQUEST = { request: { select: { uuid: true } } } as const;

export const ADMIN_ACTIVITY_INCLUDE = {
  request: { select: { uuid: true } },
  org: { select: { uuid: true, name: true } },
  actor: { select: { uuid: true, name: true } },
} as const;

// Detail views are audited on every open, so those events are left out of feeds unless asked for.
export const notAuditRead = {
  type: { not: ACTIVITY_TYPES.registrationViewed },
} satisfies Prisma.ActivityEventWhereInput;

export const activityRepository = {
  create: (tx: TxClient, data: Prisma.ActivityEventUncheckedCreateInput) => tx.activityEvent.create({ data }),

  createAdmin: (data: Prisma.ActivityEventUncheckedCreateInput) =>
    prisma.activityEvent.create({ data, include: ADMIN_ACTIVITY_INCLUDE }),

  findLatestPublicForOrg: (orgId: number, take: number) =>
    prisma.activityEvent.findMany({
      where: { orgId, visibility: ActivityVisibility.public },
      include: WITH_REQUEST,
      orderBy: NEWEST_FIRST,
      take,
    }),

  findLatestPublicForRequest: (requestId: number, take: number) =>
    prisma.activityEvent.findMany({
      where: { requestId, visibility: ActivityVisibility.public },
      include: WITH_REQUEST,
      orderBy: NEWEST_FIRST,
      take,
    }),

  findLatestAdmin: (where: Prisma.ActivityEventWhereInput, take: number) =>
    prisma.activityEvent.findMany({ where, include: ADMIN_ACTIVITY_INCLUDE, orderBy: NEWEST_FIRST, take }),

  findAdminPage: (where: Prisma.ActivityEventWhereInput, page: number) =>
    prisma.activityEvent.findMany({ where, include: ADMIN_ACTIVITY_INCLUDE, orderBy: NEWEST_FIRST, ...pageArgs(page) }),

  count: (where: Prisma.ActivityEventWhereInput) => prisma.activityEvent.count({ where }),
};
