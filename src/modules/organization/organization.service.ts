import type { TxClient } from '../../db/transaction.js';
import type { Organization } from '../../generated/prisma/client.js';
import { slugify } from '../../utils/slug.js';
import { organizationRepository } from './organization.repository.js';

export const organizationService = {
  // The slug never changes after creation, so it stays stable when the name is edited.
  uniqueSlug: async (tx: TxClient, name: string) => {
    const base = slugify(name);
    const taken = new Set(await organizationRepository.findSlugsStartingWith(tx, base));
    let slug = base;
    for (let suffix = 2; taken.has(slug); suffix++) {
      slug = `${base}-${suffix}`;
    }
    return slug;
  },

  toCompanyProfile: (org: Organization) => ({
    id: org.uuid,
    name: org.name,
    slug: org.slug,
    website: org.website,
    industry: org.industry,
    size: org.size,
    location: org.location,
    country: org.country,
    description: org.description,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  }),
};
