import type { ActivityEvent } from '../../generated/prisma/client.js';
import { toAdminRef } from '../request/request.service.js';

type Ref = { uuid: string; name: string };
type ActivityWithRequest = ActivityEvent & { request: { uuid: string } | null };
type AdminActivity = ActivityWithRequest & { org: Ref | null; actor: Ref | null };

export const activityService = {
  toCompanyActivity: (event: ActivityWithRequest) => ({
    id: event.uuid,
    requestId: event.request?.uuid ?? null,
    type: event.type,
    message: event.message,
    statusAtEvent: event.statusAtEvent,
    createdAt: event.createdAt,
  }),

  toAdminActivity: (event: AdminActivity) => ({
    ...activityService.toCompanyActivity(event),
    org: toAdminRef(event.org),
    actor: toAdminRef(event.actor),
    visibility: event.visibility,
    entityId: event.entityId,
  }),
};
