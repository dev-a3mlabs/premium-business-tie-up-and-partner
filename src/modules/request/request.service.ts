import { ACTIVITY_TYPES } from '../../config/activity-types.js';
import { STATUS_LABELS } from '../../config/request-statuses.js';
import type { TxClient } from '../../db/transaction.js';
import { ActivityVisibility, RequestStatus, type TieUpRequest } from '../../generated/prisma/client.js';
import { activityRepository } from '../activity/activity.repository.js';
import { requestRepository } from './request.repository.js';
import type { RequirementInput } from './v1/request.schema.js';

type CreateRequestsInput = {
  orgId: number;
  userId: number;
  requirements: RequirementInput[];
  policyVersion: string;
};

type Ref = { uuid: string; name: string };
type AdminRequestRow = TieUpRequest & { org: Ref; assignedAdmin: Ref | null };

export const toAdminRef = (ref: Ref | null) => (ref ? { id: ref.uuid, name: ref.name } : null);

export const requestService = {
  // Creates the requests in input order, each with its own request_submitted event.
  createMany: async (tx: TxClient, { orgId, userId, requirements, policyVersion }: CreateRequestsInput) => {
    const requests: TieUpRequest[] = [];
    for (const requirement of requirements) {
      const request = await requestRepository.create(tx, {
        ...requirement,
        orgId,
        submittedById: userId,
        policyVersion,
      });
      await activityRepository.create(tx, {
        actorId: userId,
        orgId,
        requestId: request.id,
        entityId: request.uuid,
        type: ACTIVITY_TYPES.requestSubmitted,
        message: 'Request submitted.',
        visibility: ActivityVisibility.public,
        statusAtEvent: RequestStatus.submitted,
      });
      requests.push(request);
    }
    return requests;
  },

  // The company-visible record of a status change; call after the status is written.
  recordStatusChange: (tx: TxClient, request: TieUpRequest, to: RequestStatus, actorId: number) =>
    activityRepository.create(tx, {
      actorId,
      orgId: request.orgId,
      requestId: request.id,
      entityId: request.uuid,
      type: ACTIVITY_TYPES.statusChanged,
      message: `Status changed to ${STATUS_LABELS[to]}.`,
      visibility: ActivityVisibility.public,
      statusAtEvent: to,
      metadata: { from: request.status, to },
    }),

  // Introduction actions move the request one step forward only from the exact step before.
  advanceIfAt: async (tx: TxClient, request: TieUpRequest, from: RequestStatus, to: RequestStatus, actorId: number) => {
    if (request.status !== from) return;
    await requestRepository.setStatus(request.id, to, tx);
    await requestService.recordStatusChange(tx, request, to, actorId);
  },

  toRequestBrief: (request: TieUpRequest) => ({
    ...requestService.toRequestSummary(request),
    description: request.description,
    preferredCriteria: request.preferredCriteria,
    locationPreference: request.locationPreference,
    industriesServed: request.industriesServed,
    budgetRange: request.budgetRange,
    timeline: request.timeline,
    intake: request.intake,
  }),

  toRequestSummary: (request: TieUpRequest) => ({
    id: request.uuid,
    title: request.title,
    status: request.status,
    categoryId: request.categoryId,
    subcategoryId: request.subcategoryId,
    categoryLabel: request.categoryLabel ?? request.customCategory ?? 'Category not specified',
    subcategoryLabel: request.subcategoryLabel ?? request.customSubcategory,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }),

  toAdminRequestRow: (request: AdminRequestRow) => ({
    ...requestService.toRequestSummary(request),
    company: { id: request.org.uuid, name: request.org.name },
    assignedAdmin: toAdminRef(request.assignedAdmin),
  }),
};
