import { ACTIVITY_TYPES } from '../../config/activity-types.js';
import { ERROR_CODES } from '../../config/error-codes.js';
import { TERMINAL_STATUSES } from '../../config/request-statuses.js';
import { withTransaction } from '../../db/transaction.js';
import { ActivityVisibility, RequestStatus, type Organization, type User } from '../../generated/prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPage } from '../../utils/pagination.js';
import { activityRepository } from '../activity/activity.repository.js';
import { activityService } from '../activity/activity.service.js';
import { introductionRepository } from '../introduction/introduction.repository.js';
import { introductionService } from '../introduction/introduction.service.js';
import { organizationRepository } from '../organization/organization.repository.js';
import { organizationService } from '../organization/organization.service.js';
import type { ProfileUpdateInput } from '../organization/v1/organization.schema.js';
import { requestRepository } from '../request/request.repository.js';
import { requestService } from '../request/request.service.js';
import type { CreateRequestsInput } from './v1/company.schema.js';

const DASHBOARD_REQUESTS = 5;
const DASHBOARD_EVENTS = 6;
const DETAIL_ITEMS = 50;

const requestNotFound = () => ApiError.notFound('Request not found');

export const companyService = {
  getDashboard: async (org: Organization) => {
    const [activeRequests, establishedRequests, introductions, acceptedIntroductions, recentRequests, recentActivity] =
      await Promise.all([
        requestRepository.countActiveForOrg(org.id),
        requestRepository.countEstablishedForOrg(org.id),
        introductionRepository.countSentForOrg(org.id),
        introductionRepository.countAcceptedForOrg(org.id),
        requestRepository.findLatestForOrg(org.id, DASHBOARD_REQUESTS),
        activityRepository.findLatestPublicForOrg(org.id, DASHBOARD_EVENTS),
      ]);

    return {
      counts: { activeRequests, establishedRequests, introductions, acceptedIntroductions },
      recentRequests: recentRequests.map(requestService.toRequestSummary),
      recentActivity: recentActivity.map(activityService.toCompanyActivity),
    };
  },

  getProfile: (org: Organization) => organizationService.toCompanyProfile(org),

  // Only real changes are saved; the audit event records which fields changed, not their values.
  updateProfile: async (org: Organization, user: User, input: ProfileUpdateInput) => {
    const changes = Object.fromEntries(
      Object.entries(input).filter(([field, value]) => org[field as keyof ProfileUpdateInput] !== value),
    );
    const fields = Object.keys(changes);
    if (fields.length === 0) {
      return organizationService.toCompanyProfile(org);
    }

    const updated = await withTransaction(async (tx) => {
      const result = await organizationRepository.update(org.id, changes, tx);
      await activityRepository.create(tx, {
        actorId: user.id,
        orgId: org.id,
        entityId: org.uuid,
        type: ACTIVITY_TYPES.companyProfileUpdated,
        message: 'Company profile updated.',
        visibility: ActivityVisibility.internal,
        metadata: { fields },
      });
      return result;
    });

    return organizationService.toCompanyProfile(updated);
  },

  createRequests: async (org: Organization, user: User, { requirements, policyVersion }: CreateRequestsInput) => {
    const requests = await withTransaction((tx) =>
      requestService.createMany(tx, { orgId: org.id, userId: user.id, requirements, policyVersion }),
    );
    return { requests: requests.map(requestService.toRequestSummary) };
  },

  listRequests: async (org: Organization, page: number) => {
    const [requests, total] = await Promise.all([
      requestRepository.findPageForOrg(org.id, page),
      requestRepository.countForOrg(org.id),
    ]);
    return toPage(requests.map(requestService.toRequestSummary), page, total);
  },

  getRequest: async (org: Organization, requestUuid: string) => {
    const request = await requestRepository.findForOrg(org.id, requestUuid);
    if (!request) throw requestNotFound();

    const [introductions, events] = await Promise.all([
      introductionRepository.findSentForRequest(request.id, DETAIL_ITEMS),
      activityRepository.findLatestPublicForRequest(request.id, DETAIL_ITEMS),
    ]);

    return {
      request: requestService.toRequestBrief(request),
      introductions: introductions.map(introductionService.toCompanyIntroduction),
      timeline: events.reverse().map(activityService.toCompanyActivity),
      allowedActions: { cancel: !TERMINAL_STATUSES.includes(request.status) },
    };
  },

  cancelRequest: async (org: Organization, user: User, requestUuid: string) => {
    const cancelled = await withTransaction(async (tx) => {
      const request = await requestRepository.findForOrg(org.id, requestUuid, tx);
      if (!request) throw requestNotFound();

      const { count } = await requestRepository.cancelIfOpen(request.id, tx);
      if (count === 0) {
        // Already finished, possibly by a concurrent action; a repeat cancel is not an error.
        const current = await requestRepository.findById(request.id, tx);
        if (current.status === RequestStatus.cancelled) return current;
        throw ApiError.conflict('This request can no longer be cancelled', ERROR_CODES.INVALID_TRANSITION);
      }

      const updated = await requestRepository.findById(request.id, tx);
      await requestService.recordStatusChange(tx, request, RequestStatus.cancelled, user.id);
      await introductionService.discardPendingForRequest(updated, user.id, tx);
      return updated;
    });

    return requestService.toRequestSummary(cancelled);
  },

  listIntroductions: async (org: Organization, page: number) => {
    const [introductions, total] = await Promise.all([
      introductionRepository.findSentPageForOrg(org.id, page),
      introductionRepository.countSentForOrg(org.id),
    ]);
    return toPage(introductions.map(introductionService.toCompanyIntroduction), page, total);
  },
};
