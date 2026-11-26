import { ContactStatus, type User } from '../../generated/prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPage } from '../../utils/pagination.js';
import { toAdminRef } from '../request/request.service.js';
import { contactRepository } from './contact.repository.js';
import type { ContactInput } from './v1/contact.schema.js';

type Submission = NonNullable<Awaited<ReturnType<typeof contactRepository.findByUuid>>>;

const toAdminSubmission = (submission: Submission) => ({
  id: submission.uuid,
  name: submission.name,
  email: submission.email,
  subject: submission.subject,
  message: submission.message,
  status: submission.status,
  resolvedAt: submission.resolvedAt,
  resolvedBy: toAdminRef(submission.resolvedBy),
  createdAt: submission.createdAt,
});

const findOrThrow = async (uuid: string) => {
  const submission = await contactRepository.findByUuid(uuid);
  if (!submission) throw ApiError.notFound('Contact submission not found');
  return submission;
};

export const contactService = {
  submit: async (input: ContactInput) => {
    await contactRepository.create(input);
  },

  listForAdmin: async (page: number, status?: ContactStatus) => {
    const [submissions, total] = await Promise.all([
      contactRepository.findPage(page, status),
      contactRepository.count(status),
    ]);
    return toPage(submissions.map(toAdminSubmission), page, total);
  },

  getForAdmin: async (uuid: string) => toAdminSubmission(await findOrThrow(uuid)),

  // Setting the current status again changes nothing, so the original resolver and time are kept.
  setStatus: async (admin: User, uuid: string, status: ContactStatus) => {
    const submission = await findOrThrow(uuid);
    if (submission.status === status) return toAdminSubmission(submission);

    const resolvedById = status === ContactStatus.resolved ? admin.id : null;
    return toAdminSubmission(await contactRepository.updateStatus(submission.id, status, resolvedById));
  },
};
