import { Router } from 'express';
import { authenticate, requirePlatformAdmin } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { pageQuerySchema } from '../../../utils/pagination.js';
import {
  addNote,
  assign,
  changeContactStatus,
  changeStatus,
  discardIntroduction,
  draftIntroduction,
  getContactSubmission,
  getDashboard,
  getRequest,
  listActivity,
  listCompanies,
  listContactSubmissions,
  listCoordinators,
  listIntroductions,
  listRequests,
  listUsers,
  recordResponse,
  sendIntroduction,
} from './admin.controller.js';
import {
  activityQuerySchema,
  assignmentSchema,
  contactStatusSchema,
  contactSubmissionParamsSchema,
  contactSubmissionsQuerySchema,
  draftIntroductionSchema,
  introductionsQuerySchema,
  introParamsSchema,
  noteSchema,
  requestParamsSchema,
  requestsQuerySchema,
  responseSchema,
  statusSchema,
} from './admin.schema.js';

const router = Router();

router.use(authenticate, requirePlatformAdmin);

const requestParams = validate({ params: requestParamsSchema });
const introParams = validate({ params: introParamsSchema });
const submissionParams = validate({ params: contactSubmissionParamsSchema });

router.get('/dashboard', getDashboard);
router.get('/coordinators', listCoordinators);

router.get('/requests', validate({ query: requestsQuerySchema }), listRequests);
router.get('/requests/:requestId', requestParams, getRequest);
router.patch('/requests/:requestId/status', requestParams, validate({ body: statusSchema }), changeStatus);
router.patch('/requests/:requestId/assignment', requestParams, validate({ body: assignmentSchema }), assign);
router.post('/requests/:requestId/notes', requestParams, validate({ body: noteSchema }), addNote);
router.post(
  '/requests/:requestId/introductions',
  requestParams,
  validate({ body: draftIntroductionSchema }),
  draftIntroduction,
);

router.get('/introductions', validate({ query: introductionsQuerySchema }), listIntroductions);
router.post('/introductions/:introId/send', introParams, sendIntroduction);
router.post('/introductions/:introId/response', introParams, validate({ body: responseSchema }), recordResponse);
router.post('/introductions/:introId/discard', introParams, discardIntroduction);

router.get('/companies', validate({ query: pageQuerySchema }), listCompanies);
router.get('/users', validate({ query: pageQuerySchema }), listUsers);
router.get('/activity', validate({ query: activityQuerySchema }), listActivity);

router.get('/contact-submissions', validate({ query: contactSubmissionsQuerySchema }), listContactSubmissions);
router.get('/contact-submissions/:submissionId', submissionParams, getContactSubmission);
router.patch(
  '/contact-submissions/:submissionId/status',
  submissionParams,
  validate({ body: contactStatusSchema }),
  changeContactStatus,
);

export default router;
