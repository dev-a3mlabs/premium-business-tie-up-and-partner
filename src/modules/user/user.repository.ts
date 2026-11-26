import { prisma } from '../../db/prisma.js';
import { pageArgs } from '../../utils/pagination.js';

const activeAdmin = { isPlatformAdmin: true, disabledAt: null };

export const userRepository = {
  findActiveAdmins: () =>
    prisma.user.findMany({
      where: activeAdmin,
      select: { uuid: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),

  findActiveAdminByUuid: (uuid: string) =>
    prisma.user.findFirst({ where: { ...activeAdmin, uuid }, select: { id: true, uuid: true } }),

  findPage: (page: number) =>
    prisma.user.findMany({
      include: { memberships: { include: { org: { select: { uuid: true, name: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(page),
    }),

  count: () => prisma.user.count(),
};
