import { Router } from 'express';
import { MembershipRole } from '../../../generated/prisma/client.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { requireMembership, requireOrgRole } from '../../../middlewares/org-access.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { pageQuerySchema } from '../../../utils/pagination.js';
import { profileUpdateSchema } from '../../organization/v1/organization.schema.js';
import {
  cancelRequest,
  createRequests,
  getDashboard,
  getProfile,
  getRequest,
  listIntroductions,
  listRequests,
  updateProfile,
} from './company.controller.js';
import { createRequestsSchema, requestParamsSchema } from './company.schema.js';

// Mounted at /company/:orgId; every route needs a membership in that org.
const router = Router({ mergeParams: true });

router.use(authenticate, requireMembership);

router.get('/dashboard', getDashboard);
router.get('/profile', getProfile);
router.patch(
  '/profile',
  requireOrgRole(MembershipRole.owner, MembershipRole.admin),
  validate({ body: profileUpdateSchema }),
  updateProfile,
);
router.post('/requests', validate({ body: createRequestsSchema }), createRequests);
router.get('/requests', validate({ query: pageQuerySchema }), listRequests);
router.get('/requests/:requestId', validate({ params: requestParamsSchema }), getRequest);
router.post('/requests/:requestId/cancel', validate({ params: requestParamsSchema }), cancelRequest);
router.get('/introductions', validate({ query: pageQuerySchema }), listIntroductions);

export default router;
