import { z } from 'zod';
import { policyVersionSchema, requirementsSchema } from '../../request/v1/request.schema.js';

export const createRequestsSchema = z.strictObject({
  requirements: requirementsSchema,
  policyVersion: policyVersionSchema,
});

export const requestParamsSchema = z.object({
  requestId: z.uuid('Invalid request id'),
});

export type CreateRequestsInput = z.output<typeof createRequestsSchema>;
