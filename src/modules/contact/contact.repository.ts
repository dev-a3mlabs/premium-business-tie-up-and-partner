import { prisma } from '../../db/prisma.js';
import type { ContactStatus } from '../../generated/prisma/client.js';
import { pageArgs } from '../../utils/pagination.js';
import type { ContactInput } from './v1/contact.schema.js';

const withResolvedBy = { resolvedBy: { select: { uuid: true, name: true } } } as const;

export const contactRepository = {
  create: (data: ContactInput) => prisma.contactSubmission.create({ data, select: { id: true } }),

  findPage: (page: number, status?: ContactStatus) =>
    prisma.contactSubmission.findMany({
      where: { status },
      include: withResolvedBy,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(page),
    }),

  count: (status?: ContactStatus) => prisma.contactSubmission.count({ where: { status } }),

  findByUuid: (uuid: string) => prisma.contactSubmission.findUnique({ where: { uuid }, include: withResolvedBy }),

  updateStatus: (id: number, status: ContactStatus, resolvedById: number | null) =>
    prisma.contactSubmission.update({
      where: { id },
      data: { status, resolvedById, resolvedAt: resolvedById ? new Date() : null },
      include: withResolvedBy,
    }),
};
