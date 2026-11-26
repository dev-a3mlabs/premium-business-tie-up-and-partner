import { ACTIVITY_TYPES } from '../../config/activity-types.js';
import { ERROR_CODES } from '../../config/error-codes.js';
import {
  allowedStatusTargets,
  DRAFTABLE_STATUSES,
  SENDABLE_STATUSES,
  TERMINAL_STATUSES,
} from '../../config/request-statuses.js';
import { withTransaction, type TxClient } from '../../db/transaction.js';
import {
  ActivityVisibility,
  IntroductionStatus,
  RequestStatus,
  type Introduction,
  type Prisma,
  type TieUpRequest,
  type User,
} from '../../generated/prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPage } from '../../utils/pagination.js';
import { activityRepository, notAuditRead } from '../activity/activity.repository.js';
import { activityService } from '../activity/activity.service.js';
import { introductionRepository } from '../introduction/introduction.repository.js';
import { introductionService, normalizeSpecialistName } from '../introduction/introduction.service.js';
import { organizationRepository } from '../organization/organization.repository.js';
import { organizationService } from '../organization/organization.service.js';
import { openRequest, requestRepository } from '../request/request.repository.js';
import { requestService, toAdminRef } from '../request/request.service.js';
import { userRepository } from '../user/user.repository.js';
import type {
  ActivityQuery,
  DraftIntroductionInput,
  IntroductionsQuery,
  RequestsQuery,
  ResponseInput,
} from './v1/admin.schema.js';

const DASHBOARD_REQUESTS = 6;
const DASHBOARD_EVENTS = 8;
const DETAIL_ITEMS = 50;

const requestNotFound = () => ApiError.notFound('Request not found');
const introNotFound = () => ApiError.notFound('Introduction not found');
const invalidTransition = (message: string) => ApiError.conflict(message, ERROR_CODES.INVALID_TRANSITION);

const findRequestOrThrow = async (uuid: string, tx?: TxClient) => {
  const request = await requestRepository.findByUuid(uuid, tx);
  if (!request) throw requestNotFound();
  return request;
};

const adminRow = async (id: number) => requestService.toAdminRequestRow(await requestRepository.findAdminRow(id));

const adminIntro = async (id: number) => introductionService.toAdminIntroduction(await introductionRepository.findAdmin(id));

// Locks the parent request first, then re-reads the introduction, so actions on one request run one at a time.
const withIntroLock = async <T>(
  introUuid: string,
  fn: (tx: TxClient, intro: Introduction, request: TieUpRequest) => Promise<T>,
) =>
  withTransaction(async (tx) => {
    const found = await introductionRepository.findByUuid(introUuid, tx);
    if (!found) throw introNotFound();
    const request = await requestRepository.lock(found.requestId, tx);
    const intro = await introductionRepository.findByUuid(introUuid, tx);
    return fn(tx, intro!, request);
  });

const introEvent = (
  tx: TxClient,
  admin: User,
  request: TieUpRequest,
  intro: Introduction,
  event: { type: string; message: string; visibility: ActivityVisibility; statusAtEvent: RequestStatus },
) =>
  activityRepository.create(tx, {
    actorId: admin.id,
    orgId: request.orgId,
    requestId: request.id,
    entityId: intro.uuid,
    ...event,
  });

export const adminService = {
  getDashboard: async () => {
    const liveIntros = { discardedAt: null } satisfies Prisma.IntroductionWhereInput;
    const [openRequests, submittedRequests, companies, introductions, inFlightIntroductions, latestOpen, latestEvents] =
      await Promise.all([
        requestRepository.count(openRequest),
        requestRepository.count({ status: RequestStatus.submitted }),
        organizationRepository.count(),
        introductionRepository.count(liveIntros),
        introductionRepository.count({
          ...liveIntros,
          status: { in: [IntroductionStatus.pending, IntroductionStatus.sent] },
        }),
        requestRepository.findLatestAdminRows(openRequest, DASHBOARD_REQUESTS),
        activityRepository.findLatestAdmin(notAuditRead, DASHBOARD_EVENTS),
      ]);

    return {
      counts: { openRequests, submittedRequests, companies, introductions, inFlightIntroductions },
      openRequests: latestOpen.map(requestService.toAdminRequestRow),
      recentActivity: latestEvents.map(activityService.toAdminActivity),
    };
  },

  listRequests: async ({ page, status, assignee }: RequestsQuery) => {
    const where: Prisma.TieUpRequestWhereInput = {
      ...(status && { status }),
      ...(assignee === 'unassigned' && { assignedAdminId: null }),
      ...(assignee && assignee !== 'unassigned' && { assignedAdmin: { uuid: assignee } }),
    };
    const [requests, total] = await Promise.all([
      requestRepository.findAdminPage(where, page),
      requestRepository.count(where),
    ]);
    return toPage(requests.map(requestService.toAdminRequestRow), page, total);
  },

  listCoordinators: async () => {
    const admins = await userRepository.findActiveAdmins();
    return { items: admins.map(toAdminRef) };
  },

  // Tax IDs are shown only here, and every view is recorded before they are returned.
  getRequest: async (admin: User, requestUuid: string) => {
    const request = await requestRepository.findAdminDetail(requestUuid);
    if (!request) throw requestNotFound();

    await activityRepository.createAdmin({
      actorId: admin.id,
      orgId: request.orgId,
      requestId: request.id,
      entityId: request.org.uuid,
      type: ACTIVITY_TYPES.registrationViewed,
      message: 'Company registration details viewed.',
      visibility: ActivityVisibility.internal,
      statusAtEvent: request.status,
    });

    const [introductions, timeline, notes] = await Promise.all([
      introductionRepository.findAdminForRequest(request.id, DETAIL_ITEMS),
      activityRepository.findLatestAdmin(
        { requestId: request.id, type: { notIn: [ACTIVITY_TYPES.internalNote, ACTIVITY_TYPES.registrationViewed] } },
        DETAIL_ITEMS,
      ),
      activityRepository.findLatestAdmin({ requestId: request.id, type: ACTIVITY_TYPES.internalNote }, DETAIL_ITEMS),
    ]);

    const { org } = request;
    return {
      request: requestService.toRequestBrief(request),
      company: {
        ...organizationService.toCompanyProfile(org),
        registration: {
          entityType: org.entityType,
          gstin: org.gstin,
          pan: org.pan,
          udyamNumber: org.udyamNumber,
          legalName: org.legalName,
          gstinVerifiedAt: org.gstinVerifiedAt,
          panVerifiedAt: org.panVerifiedAt,
          udyamVerifiedAt: org.udyamVerifiedAt,
        },
      },
      assignedAdmin: toAdminRef(request.assignedAdmin),
      introductions: introductions.map(introductionService.toAdminIntroduction),
      timeline: timeline.reverse().map(activityService.toAdminActivity),
      internalNotes: notes.map(activityService.toAdminActivity),
      allowedActions: {
        changeStatusTo: allowedStatusTargets(request.status),
        assign: true,
        addNote: true,
        draftIntroduction: DRAFTABLE_STATUSES.includes(request.status),
      },
    };
  },

  changeStatus: async (admin: User, requestUuid: string, status: RequestStatus) => {
    const requestId = await withTransaction(async (tx) => {
      const found = await findRequestOrThrow(requestUuid, tx);
      if (found.status === status) return found.id;

      const request = await requestRepository.lock(found.id, tx);
      if (request.status === status) return request.id;
      if (!allowedStatusTargets(request.status).includes(status)) {
        throw invalidTransition('This status change is not allowed');
      }

      const updated = await requestRepository.setStatus(request.id, status, tx);
      await requestService.recordStatusChange(tx, request, status, admin.id);
      if (TERMINAL_STATUSES.includes(status)) {
        await introductionService.discardPendingForRequest(updated, admin.id, tx);
      }
      return request.id;
    });

    return adminRow(requestId);
  },

  assign: async (admin: User, requestUuid: string, adminUuid: string | null) => {
    const request = await findRequestOrThrow(requestUuid);
    const target = adminUuid ? await userRepository.findActiveAdminByUuid(adminUuid) : null;
    if (adminUuid && !target) {
      throw ApiError.validation([{ field: 'adminId', message: 'Choose an active coordinator' }]);
    }

    const assignedAdminId = target?.id ?? null;
    if (request.assignedAdminId !== assignedAdminId) {
      await withTransaction(async (tx) => {
        await requestRepository.setAssignee(request.id, assignedAdminId, tx);
        await activityRepository.create(tx, {
          actorId: admin.id,
          orgId: request.orgId,
          requestId: request.id,
          entityId: request.uuid,
          type: ACTIVITY_TYPES.requestAssigned,
          message: target ? 'Request assigned.' : 'Request unassigned.',
          visibility: ActivityVisibility.internal,
          statusAtEvent: request.status,
          metadata: { adminId: target?.uuid ?? null },
        });
      });
    }

    return adminRow(request.id);
  },

  addNote: async (admin: User, requestUuid: string, message: string) => {
    const request = await findRequestOrThrow(requestUuid);
    const note = await activityRepository.createAdmin({
      actorId: admin.id,
      orgId: request.orgId,
      requestId: request.id,
      type: ACTIVITY_TYPES.internalNote,
      message,
      visibility: ActivityVisibility.internal,
      statusAtEvent: request.status,
    });
    return activityService.toAdminActivity(note);
  },

  draftIntroduction: async (admin: User, requestUuid: string, { specialistName, message }: DraftIntroductionInput) => {
    const introId = await withTransaction(async (tx) => {
      const found = await findRequestOrThrow(requestUuid, tx);
      const request = await requestRepository.lock(found.id, tx);
      if (!DRAFTABLE_STATUSES.includes(request.status)) {
        throw invalidTransition('Introductions cannot be drafted at this stage');
      }

      const openNames = await introductionRepository.findOpenNamesForRequest(request.id, tx);
      const name = normalizeSpecialistName(specialistName);
      if (openNames.some((open) => normalizeSpecialistName(open) === name)) {
        throw ApiError.conflict(
          'This specialist already has an open introduction for this request',
          ERROR_CODES.INTRO_EXISTS,
        );
      }

      const intro = await introductionRepository.create(tx, {
        requestId: request.id,
        specialistName,
        message,
        createdById: admin.id,
      });
      const next = request.status === RequestStatus.shortlisted ? RequestStatus.intro_pending : request.status;
      await introEvent(tx, admin, request, intro, {
        type: ACTIVITY_TYPES.introDrafted,
        message: 'Introduction drafted.',
        visibility: ActivityVisibility.internal,
        statusAtEvent: next,
      });
      await requestService.advanceIfAt(tx, request, RequestStatus.shortlisted, RequestStatus.intro_pending, admin.id);
      return intro.id;
    });

    return adminIntro(introId);
  },

  listIntroductions: async ({ page, status }: IntroductionsQuery) => {
    const where: Prisma.IntroductionWhereInput = { discardedAt: null, ...(status && { status }) };
    const [introductions, total] = await Promise.all([
      introductionRepository.findAdminPage(where, page),
      introductionRepository.count(where),
    ]);
    return toPage(introductions.map(introductionService.toAdminIntroduction), page, total);
  },

  // Sending publishes the introduction to the company workspace.
  sendIntroduction: async (admin: User, introUuid: string) => {
    const introId = await withIntroLock(introUuid, async (tx, intro, request) => {
      if (intro.discardedAt || intro.status !== IntroductionStatus.pending) {
        throw invalidTransition('Only a draft introduction can be sent');
      }
      if (!SENDABLE_STATUSES.includes(request.status)) {
        throw invalidTransition('Introductions cannot be sent at this stage');
      }

      await introductionRepository.update(
        intro.id,
        { status: IntroductionStatus.sent, sentAt: new Date(), sentById: admin.id },
        tx,
      );
      const next = request.status === RequestStatus.intro_pending ? RequestStatus.intro_sent : request.status;
      await introEvent(tx, admin, request, intro, {
        type: ACTIVITY_TYPES.introSent,
        message: 'An introduction was sent.',
        visibility: ActivityVisibility.public,
        statusAtEvent: next,
      });
      await requestService.advanceIfAt(tx, request, RequestStatus.intro_pending, RequestStatus.intro_sent, admin.id);
      return intro.id;
    });

    return adminIntro(introId);
  },

  // Replies are recorded even after the request has ended; they only move an open request forward.
  recordResponse: async (admin: User, introUuid: string, { status }: ResponseInput) => {
    const introId = await withIntroLock(introUuid, async (tx, intro, request) => {
      if (intro.discardedAt || intro.status !== IntroductionStatus.sent) {
        throw invalidTransition('A response can only be recorded for a sent introduction');
      }

      await introductionRepository.update(intro.id, { status, respondedAt: new Date(), respondedById: admin.id }, tx);
      const accepted = status === IntroductionStatus.accepted;
      const next = accepted && request.status === RequestStatus.intro_sent ? RequestStatus.discussion : request.status;
      await introEvent(tx, admin, request, intro, {
        type: accepted ? ACTIVITY_TYPES.introAccepted : ACTIVITY_TYPES.introDeclined,
        message: accepted ? 'A specialist accepted the introduction.' : 'A specialist declined the introduction.',
        visibility: ActivityVisibility.public,
        statusAtEvent: next,
      });
      if (accepted) {
        await requestService.advanceIfAt(tx, request, RequestStatus.intro_sent, RequestStatus.discussion, admin.id);
      }
      return intro.id;
    });

    return adminIntro(introId);
  },

  discardIntroduction: async (admin: User, introUuid: string) => {
    await withIntroLock(introUuid, async (tx, intro, request) => {
      if (intro.discardedAt) return;
      if (intro.status !== IntroductionStatus.pending) {
        throw invalidTransition('Only a draft introduction can be discarded');
      }

      await introductionRepository.discard([intro.id], admin.id, tx);
      await introEvent(tx, admin, request, intro, {
        type: ACTIVITY_TYPES.introDiscarded,
        message: 'Draft introduction discarded.',
        visibility: ActivityVisibility.internal,
        statusAtEvent: request.status,
      });
    });
  },

  listCompanies: async (page: number) => {
    const [orgs, total] = await Promise.all([
      organizationRepository.findPageWithCounts(page),
      organizationRepository.count(),
    ]);
    const items = orgs.map((org) => ({
      id: org.uuid,
      name: org.name,
      industry: org.industry,
      location: org.location,
      country: org.country,
      size: org.size,
      requestCount: org._count.requests,
      memberCount: org._count.memberships,
      createdAt: org.createdAt,
    }));
    return toPage(items, page, total);
  },

  listUsers: async (page: number) => {
    const [users, total] = await Promise.all([userRepository.findPage(page), userRepository.count()]);
    const items = users.map((user) => ({
      user: {
        id: user.uuid,
        name: user.name,
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin,
        createdAt: user.createdAt,
      },
      memberships: user.memberships.map((m) => ({ orgId: m.org.uuid, orgName: m.org.name, role: m.role })),
    }));
    return toPage(items, page, total);
  },

  listActivity: async ({ page, visibility, type, q }: ActivityQuery) => {
    // Prisma passes `contains` to LIKE as-is, so % and _ are escaped to match literally.
    const search = q?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.ActivityEventWhereInput = {
      ...(type ? { type } : notAuditRead),
      ...(visibility && { visibility }),
      ...(search && { OR: [{ type: { contains: search } }, { message: { contains: search } }] }),
    };
    const [events, total] = await Promise.all([
      activityRepository.findAdminPage(where, page),
      activityRepository.count(where),
    ]);
    return toPage(events.map(activityService.toAdminActivity), page, total);
  },
};
