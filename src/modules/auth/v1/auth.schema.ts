import { z } from 'zod';
import { organizationRegistrationSchema } from '../../organization/v1/organization.schema.js';
import { policyVersionSchema, requirementsSchema } from '../../request/v1/request.schema.js';

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email'));

// bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently cut.
const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password is too long');

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshTokenSchema = z.strictObject({
  refreshToken: z.string().min(1).max(200),
});

export const companyRegistrationSchema = z.strictObject({
  contact: z.strictObject({
    contactName: z.string().trim().min(2).max(120),
    email: emailSchema,
    password: passwordSchema,
  }),
  org: organizationRegistrationSchema,
  requirements: requirementsSchema,
  policyVersion: policyVersionSchema,
});

export type LoginInput = z.output<typeof loginSchema>;
export type CompanyRegistrationInput = z.output<typeof companyRegistrationSchema>;
