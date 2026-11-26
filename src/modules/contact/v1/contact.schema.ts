import { z } from 'zod';
import { CONTACT_SUBJECTS } from '../../../config/form-options.js';
import { emailSchema } from '../../auth/v1/auth.schema.js';

export const contactSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(10).max(3000),
});

export type ContactInput = z.output<typeof contactSchema>;
