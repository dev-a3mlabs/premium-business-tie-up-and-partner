import { ACTIVITY_TYPES } from '../../config/activity-types.js';
import type { TxClient } from '../../db/transaction.js';
import { SENDABLE_STATUSES } from '../../config/request-statuses.js';
import {
  ActivityVisibility,
  IntroductionStatus,
  type Introduction,
  type RequestStatus,
  type TieUpRequest,
} from '../../generated/prisma/client.js';
import { activityRepository } from '../activity/activity.repository.js';
import { toAdminRef } from '../request/request.service.js';
import { introductionRepository } from './introduction.repository.js';

type Ref = { uuid: string; name: string };
type IntroductionWithRequest = Introduction & { request: { uuid: string; title: string } };
type AdminIntroduction = Introduction & {
  request: { uuid: string; title: string; status: RequestStatus; org: Ref };
  createdBy: Ref;
  sentBy: Ref | null;
  respondedBy: Ref | null;
};

// "Asha  Rao " and "asha rao" are the same specialist for the duplicate check.
export const normalizeSpecialistName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const introductionService = {
  // A finished request can't send its drafts, so they are discarded with an internal audit event each.
  discardPendingForRequest: async (request: TieUpRequest, userId: number, tx: TxClient) => {
    const drafts = await introductionRepository.findPendingForRequest(request.id, tx);
    if (drafts.length === 0) return;

    await introductionRepository.discard(
      drafts.map((draft) => draft.id),
      userId,
      tx,
    );
    for (const draft of drafts) {
      await activityRepository.create(tx, {
        actorId: userId,
        orgId: request.orgId,
        requestId: request.id,
        entityId: draft.uuid,
        type: ACTIVITY_TYPES.introDiscarded,
        message: 'Draft introduction discarded because the request ended.',
        visibility: ActivityVisibility.internal,
        statusAtEvent: request.status,
      });
    }
  },

  toAdminIntroduction: (intro: AdminIntroduction) => {
    const isDraft = intro.status === IntroductionStatus.pending && !intro.discardedAt;
    return {
      id: intro.uuid,
      request: { id: intro.request.uuid, title: intro.request.title },
      company: { id: intro.request.org.uuid, name: intro.request.org.name },
      specialistName: intro.specialistName,
      message: intro.message,
      status: intro.status,
      createdAt: intro.createdAt,
      sentAt: intro.sentAt,
      respondedAt: intro.respondedAt,
      discardedAt: intro.discardedAt,
      createdBy: toAdminRef(intro.createdBy),
      sentBy: toAdminRef(intro.sentBy),
      respondedBy: toAdminRef(intro.respondedBy),
      allowedActions: {
        send: isDraft && SENDABLE_STATUSES.includes(intro.request.status),
        respond: intro.status === IntroductionStatus.sent,
        discard: isDraft,
      },
    };
  },

  toCompanyIntroduction: (intro: IntroductionWithRequest) => ({
    id: intro.uuid,
    request: { id: intro.request.uuid, title: intro.request.title },
    specialistName: intro.specialistName,
    message: intro.message,
    status: intro.status,
    createdAt: intro.createdAt,
    sentAt: intro.sentAt,
    respondedAt: intro.respondedAt,
  }),
};
