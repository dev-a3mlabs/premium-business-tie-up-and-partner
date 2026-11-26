import { z } from 'zod';
import {
  CATEGORY_OTHER,
  ENGAGEMENT_MODELS,
  INDUSTRY_OTHER,
  READINESS_LEVELS,
  SUBCATEGORY_NOT_SPECIFIED,
} from '../../../config/form-options.js';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).default('');

const intakeSchema = z.strictObject({
  companyContext: text(20, 1500),
  currentSetup: optionalText(1500),
  deliverables: text(15, 1500),
  successCriteria: text(12, 1000),
  constraints: optionalText(1000),
  engagementModel: z.enum(ENGAGEMENT_MODELS),
  readiness: z.enum(READINESS_LEVELS),
  decisionProcess: optionalText(1000),
});

const MAX_OTHER_INDUSTRIES = 40;

export const requirementSchema = z
  .strictObject({
    categoryId: text(1, 48),
    subcategoryId: text(1, 48),
    categoryLabel: optionalText(120),
    subcategoryLabel: optionalText(120),
    customCategory: optionalText(120),
    customSubcategory: optionalText(120),
    title: text(4, 140),
    description: text(20, 3000),
    intake: intakeSchema,
    budgetRange: text(1, 120),
    timeline: text(1, 120),
    locationPreference: optionalText(120),
    preferredCriteria: optionalText(1000),
    industriesServed: z.array(text(1, 80)).max(25),
    otherIndustries: optionalText(600),
  })
  .superRefine((r, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const categoryIsOther = r.categoryId === CATEGORY_OTHER;
    const subIsOther = r.subcategoryId === CATEGORY_OTHER;
    const subIsReal = !subIsOther && r.subcategoryId !== SUBCATEGORY_NOT_SPECIFIED;

    if (categoryIsOther && subIsReal) issue('subcategoryId', 'Choose Other or Not specified for a custom category');
    if (categoryIsOther !== Boolean(r.customCategory)) {
      issue('customCategory', categoryIsOther ? 'Enter the category' : 'Only allowed when the category is Other');
    }
    if (subIsOther !== Boolean(r.customSubcategory)) {
      issue('customSubcategory', subIsOther ? 'Enter the subcategory' : 'Only allowed when the subcategory is Other');
    }
    if (!categoryIsOther && !r.categoryLabel) issue('categoryLabel', 'Category label is required');
    if (subIsReal && !categoryIsOther && !r.subcategoryLabel) issue('subcategoryLabel', 'Subcategory label is required');

    const hasOtherIndustry = r.industriesServed.includes(INDUSTRY_OTHER);
    if (hasOtherIndustry && !r.otherIndustries) issue('otherIndustries', 'Enter the other industries');
    if (!hasOtherIndustry && r.otherIndustries) issue('otherIndustries', 'Only allowed when Other is selected');
    if (hasOtherIndustry && r.otherIndustries) {
      const names = splitIndustries(r.otherIndustries);
      if (names.length === 0) issue('otherIndustries', 'Enter at least one industry');
      if (names.some((name) => name.length > 80)) issue('otherIndustries', 'Each industry must be 80 characters or fewer');
      if (names.length > MAX_OTHER_INDUSTRIES) issue('otherIndustries', `Enter at most ${MAX_OTHER_INDUSTRIES} industries`);
    }
  })
  .transform((r) => {
    const categoryIsOther = r.categoryId === CATEGORY_OTHER;
    const subIsReal = r.subcategoryId !== CATEGORY_OTHER && r.subcategoryId !== SUBCATEGORY_NOT_SPECIFIED;
    const industries = [
      ...r.industriesServed.filter((name) => name !== INDUSTRY_OTHER),
      ...splitIndustries(r.otherIndustries),
    ];

    return {
      categoryId: categoryIsOther ? null : r.categoryId,
      subcategoryId: subIsReal ? r.subcategoryId : null,
      categoryLabel: categoryIsOther ? null : r.categoryLabel,
      subcategoryLabel: subIsReal ? r.subcategoryLabel : null,
      customCategory: r.customCategory || null,
      customSubcategory: r.customSubcategory || null,
      title: r.title,
      description: r.description,
      intake: r.intake,
      budgetRange: r.budgetRange,
      timeline: r.timeline,
      locationPreference: r.locationPreference,
      preferredCriteria: r.preferredCriteria,
      industriesServed: dedupeCaseInsensitive(industries),
    };
  });

export const requirementsSchema = z.array(requirementSchema).min(1).max(10);

export const policyVersionSchema = text(1, 64);

export type RequirementInput = z.output<typeof requirementSchema>;

function splitIndustries(raw: string) {
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function dedupeCaseInsensitive(names: string[]) {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
