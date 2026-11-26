// Exact option values the frontend forms send; keep in sync with the frontend.

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;

export const CONTACT_SUBJECTS = [
  'Writing a business brief',
  'Requests and introductions',
  'Platform feedback',
  'Other',
] as const;

export const ENGAGEMENT_MODELS = [
  'One-off project',
  'Ongoing support',
  'Pilot or trial',
  'Advisory only',
  'Not decided yet',
] as const;

export const ENTITY_TYPES = [
  'Individual / Proprietorship',
  'Partnership',
  'LLP',
  'Private Limited / Public Limited',
  'Other',
] as const;

export const READINESS_LEVELS = [
  'Exploring options',
  'Defining the scope',
  'Preparing to select a partner',
  'Ready to start',
] as const;

// Sentinels in the category pickers; never stored as IDs.
export const CATEGORY_OTHER = 'other';
export const SUBCATEGORY_NOT_SPECIFIED = 'not-specified';
export const INDUSTRY_OTHER = 'Other';
