import { z } from 'zod';
import { COMPANY_SIZES, ENTITY_TYPES } from '../../../config/form-options.js';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const MAX_WEBSITE_LENGTH = 300;

// A plain domain becomes https://domain; anything else must be an absolute http(s) URL without credentials.
const websiteSchema = z
  .string()
  .trim()
  .max(MAX_WEBSITE_LENGTH)
  .transform((value, ctx) => {
    if (!value) return '';
    const withScheme = value.includes('://') ? value : `https://${value}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid website' });
      return z.NEVER;
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid website' });
      return z.NEVER;
    }
    if (withScheme.length > MAX_WEBSITE_LENGTH) {
      ctx.addIssue({ code: 'custom', message: `Website must be ${MAX_WEBSITE_LENGTH} characters or fewer` });
      return z.NEVER;
    }
    return withScheme;
  });

const upper = (pattern: RegExp, message: string) => z.string().trim().toUpperCase().regex(pattern, message);

const registrationSchema = z
  .strictObject({
    entityType: z.enum(ENTITY_TYPES),
    gstin: upper(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/, 'Enter a valid GSTIN'),
    pan: upper(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN'),
    udyamNumber: z
      .string()
      .trim()
      .toUpperCase()
      .default('')
      .refine((value) => !value || /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(value), 'Enter a valid Udyam number')
      .transform((value) => value || null),
  })
  .superRefine((r, ctx) => {
    if (r.gstin.slice(2, 12) !== r.pan) {
      ctx.addIssue({ code: 'custom', path: ['pan'], message: 'PAN must match the GSTIN' });
    }
  });

export const profileFields = {
  name: text(2, 120),
  website: websiteSchema,
  industry: text(1, 80),
  size: z.enum(COMPANY_SIZES),
  location: text(2, 120),
  country: text(2, 80),
  description: text(20, 2000),
};

export const organizationRegistrationSchema = z.strictObject({
  ...profileFields,
  website: websiteSchema.default(''),
  registration: registrationSchema,
});

// The slug and registration numbers can't be changed here.
export const profileUpdateSchema = z
  .strictObject(profileFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to update');

export type OrganizationRegistrationInput = z.output<typeof organizationRegistrationSchema>;
export type ProfileUpdateInput = z.output<typeof profileUpdateSchema>;
