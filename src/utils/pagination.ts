import { z } from 'zod';

export const PAGE_SIZE = 25;

export const pageQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
});

export const toPage = <T>(items: T[], page: number, totalItems: number) => ({
  items,
  pagination: {
    page,
    pageSize: PAGE_SIZE,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / PAGE_SIZE)),
  },
});

export const pageArgs = (page: number) => ({ skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
