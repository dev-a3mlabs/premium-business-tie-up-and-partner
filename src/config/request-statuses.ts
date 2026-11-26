import { RequestStatus } from '../generated/prisma/client.js';

// A request in one of these is finished and never changes status again.
export const TERMINAL_STATUSES: RequestStatus[] = [
  RequestStatus.cancelled,
  RequestStatus.closed,
  RequestStatus.established,
];

// Steps an admin sets by hand. intro_pending, intro_sent and discussion are reached only through introductions.
export const MANUAL_NEXT_STATUS: Partial<Record<RequestStatus, RequestStatus>> = {
  [RequestStatus.submitted]: RequestStatus.under_review,
  [RequestStatus.under_review]: RequestStatus.partner_search,
  [RequestStatus.partner_search]: RequestStatus.shortlisted,
  [RequestStatus.discussion]: RequestStatus.established,
};

export const DRAFTABLE_STATUSES: RequestStatus[] = [
  RequestStatus.shortlisted,
  RequestStatus.intro_pending,
  RequestStatus.intro_sent,
  RequestStatus.discussion,
];

export const SENDABLE_STATUSES: RequestStatus[] = [
  RequestStatus.intro_pending,
  RequestStatus.intro_sent,
  RequestStatus.discussion,
];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.submitted]: 'Submitted',
  [RequestStatus.under_review]: 'Under Review',
  [RequestStatus.partner_search]: 'Specialist Search in Progress',
  [RequestStatus.shortlisted]: 'Specialists Shortlisted',
  [RequestStatus.intro_pending]: 'Introduction Pending',
  [RequestStatus.intro_sent]: 'Introduction Sent',
  [RequestStatus.discussion]: 'Discussion in Progress',
  [RequestStatus.established]: 'Established',
  [RequestStatus.closed]: 'Closed',
  [RequestStatus.cancelled]: 'Cancelled',
};

export const allowedStatusTargets = (status: RequestStatus): RequestStatus[] => {
  if (TERMINAL_STATUSES.includes(status)) return [];
  const next = MANUAL_NEXT_STATUS[status];
  return [...(next ? [next] : []), RequestStatus.closed, RequestStatus.cancelled];
};
