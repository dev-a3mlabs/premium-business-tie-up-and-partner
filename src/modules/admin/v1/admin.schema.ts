import { z } from 'zod';
import { ActivityVisibility, IntroductionStatus, RequestStatus } from '../../../generated/prisma/client.js';
import { pageQuerySchema } from '../../../utils/pagination.js';

export const requestsQuerySchema = pageQuerySchema.extend({
  status: z.enum(RequestStatus).optional(),
  assignee: z.union([z.literal('unassigned'), z.uuid('Invalid assignee')]).optional(),
});

export const introductionsQuerySchema = pageQuerySchema.extend({
  status: z.enum(IntroductionStatus).optional(),
});

export const activityQuerySchema = pageQuerySchema.extend({
  visibility: z.enum(ActivityVisibility).optional(),
  type: z.string().trim().min(1).max(48).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const requestParamsSchema = z.object({ requestId: z.uuid('Invalid request id') });

export const introParamsSchema = z.object({ introId: z.uuid('Invalid introduction id') });

export const statusSchema = z.strictObject({ status: z.enum(RequestStatus) });

export const assignmentSchema = z.strictObject({ adminId: z.uuid('Choose an active coordinator').nullable() });

export const noteSchema = z.strictObject({ message: z.string().trim().min(1).max(2000) });

export const draftIntroductionSchema = z.strictObject({
  specialistName: z
    .string()
    .trim()
    .transform((name) => name.replace(/\s+/g, ' '))
    .pipe(z.string().min(2).max(120)),
  message: z.string().trim().min(20).max(2000),
});

export const responseSchema = z.strictObject({
  status: z.enum([IntroductionStatus.accepted, IntroductionStatus.declined]),
});

export type RequestsQuery = z.output<typeof requestsQuerySchema>;
export type IntroductionsQuery = z.output<typeof introductionsQuerySchema>;
export type ActivityQuery = z.output<typeof activityQuerySchema>;
export type DraftIntroductionInput = z.output<typeof draftIntroductionSchema>;
export type ResponseInput = z.output<typeof responseSchema>;
