import { prisma } from '../../db/prisma.js';
import type { ContactInput } from './v1/contact.schema.js';

export const contactRepository = {
  create: (data: ContactInput) => prisma.contactSubmission.create({ data, select: { id: true } }),
};
