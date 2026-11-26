import { TERMINAL_STATUSES } from '../../config/request-statuses.js';
import { prisma } from '../../db/prisma.js';
import type { TxClient } from '../../db/transaction.js';
import { RequestStatus, type Prisma } from '../../generated/prisma/client.js';
import { pageArgs } from '../../utils/pagination.js';

const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

export const ADMIN_ROW_INCLUDE = {
  org: { select: { uuid: true, name: true } },
  assignedAdmin: { select: { uuid: true, name: true } },
} as const;

export const openRequest = { status: { notIn: TERMINAL_STATUSES } } satisfies Prisma.TieUpRequestWhereInput;

export const requestRepository = {
  create: (tx: TxClient, data: Prisma.TieUpRequestUncheckedCreateInput) => tx.tieUpRequest.create({ data }),

  findPageForOrg: (orgId: number, page: number) =>
    prisma.tieUpRequest.findMany({ where: { orgId }, orderBy: NEWEST_FIRST, ...pageArgs(page) }),

  findLatestForOrg: (orgId: number, take: number) =>
    prisma.tieUpRequest.findMany({ where: { orgId }, orderBy: NEWEST_FIRST, take }),

  countForOrg: (orgId: number) => prisma.tieUpRequest.count({ where: { orgId } }),

  countActiveForOrg: (orgId: number) => prisma.tieUpRequest.count({ where: { orgId, ...openRequest } }),

  countEstablishedForOrg: (orgId: number) =>
    prisma.tieUpRequest.count({ where: { orgId, status: RequestStatus.established } }),

  // Scoped by org as well as uuid, so a request from another company is never found.
  findForOrg: (orgId: number, uuid: string, tx: TxClient = prisma) =>
    tx.tieUpRequest.findFirst({ where: { orgId, uuid } }),

  findById: (id: number, tx: TxClient = prisma) => tx.tieUpRequest.findUniqueOrThrow({ where: { id } }),

  findByUuid: (uuid: string, tx: TxClient = prisma) => tx.tieUpRequest.findUnique({ where: { uuid } }),

  findAdminRow: (id: number, tx: TxClient = prisma) =>
    tx.tieUpRequest.findUniqueOrThrow({ where: { id }, include: ADMIN_ROW_INCLUDE }),

  findAdminDetail: (uuid: string) =>
    prisma.tieUpRequest.findUnique({ where: { uuid }, include: { org: true, assignedAdmin: true } }),

  findAdminPage: (where: Prisma.TieUpRequestWhereInput, page: number) =>
    prisma.tieUpRequest.findMany({ where, include: ADMIN_ROW_INCLUDE, orderBy: NEWEST_FIRST, ...pageArgs(page) }),

  findLatestAdminRows: (where: Prisma.TieUpRequestWhereInput, take: number) =>
    prisma.tieUpRequest.findMany({ where, include: ADMIN_ROW_INCLUDE, orderBy: NEWEST_FIRST, take }),

  count: (where: Prisma.TieUpRequestWhereInput) => prisma.tieUpRequest.count({ where }),

  // Writing the row locks it until the transaction ends, so concurrent actions on one request run one at a time.
  lock: (id: number, tx: TxClient) => tx.tieUpRequest.update({ where: { id }, data: { updatedAt: new Date() } }),

  setStatus: (id: number, status: RequestStatus, tx: TxClient) =>
    tx.tieUpRequest.update({ where: { id }, data: { status } }),

  setAssignee: (id: number, assignedAdminId: number | null, tx: TxClient) =>
    tx.tieUpRequest.update({ where: { id }, data: { assignedAdminId } }),

  // Only moves a request that is still open, so it can't race past a concurrent close.
  cancelIfOpen: (id: number, tx: TxClient) =>
    tx.tieUpRequest.updateMany({ where: { id, ...openRequest }, data: { status: RequestStatus.cancelled } }),
};
