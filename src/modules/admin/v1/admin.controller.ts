import type { Request, Response } from 'express';
import type { AuthRequest } from '../../../middlewares/auth.middleware.js';
import { sendSuccess } from '../../../utils/response.js';
import { adminService } from '../admin.service.js';
import type { ActivityQuery, IntroductionsQuery, RequestsQuery } from './admin.schema.js';

// Query and params are already parsed by validate().
const queryOf = <T>(req: Request) => req.query as unknown as T;
const requestIdOf = (req: Request) => (req.params as { requestId: string }).requestId;
const introIdOf = (req: Request) => (req.params as { introId: string }).introId;
const adminOf = (req: Request) => (req as AuthRequest).user;

export const getDashboard = async (_req: Request, res: Response) => {
  sendSuccess(res, { message: 'Dashboard fetched', data: await adminService.getDashboard() });
};

export const listRequests = async (req: Request, res: Response) => {
  const data = await adminService.listRequests(queryOf<RequestsQuery>(req));
  sendSuccess(res, { message: 'Requests fetched', data });
};

export const listCoordinators = async (_req: Request, res: Response) => {
  sendSuccess(res, { message: 'Coordinators fetched', data: await adminService.listCoordinators() });
};

export const getRequest = async (req: Request, res: Response) => {
  const data = await adminService.getRequest(adminOf(req), requestIdOf(req));
  sendSuccess(res, { message: 'Request fetched', data });
};

export const changeStatus = async (req: Request, res: Response) => {
  const data = await adminService.changeStatus(adminOf(req), requestIdOf(req), req.body.status);
  sendSuccess(res, { message: 'Status updated', data });
};

export const assign = async (req: Request, res: Response) => {
  const data = await adminService.assign(adminOf(req), requestIdOf(req), req.body.adminId);
  sendSuccess(res, { message: 'Assignment updated', data });
};

export const addNote = async (req: Request, res: Response) => {
  const data = await adminService.addNote(adminOf(req), requestIdOf(req), req.body.message);
  sendSuccess(res, { message: 'Note added', data, statusCode: 201 });
};

export const draftIntroduction = async (req: Request, res: Response) => {
  const data = await adminService.draftIntroduction(adminOf(req), requestIdOf(req), req.body);
  sendSuccess(res, { message: 'Introduction drafted', data, statusCode: 201 });
};

export const listIntroductions = async (req: Request, res: Response) => {
  const data = await adminService.listIntroductions(queryOf<IntroductionsQuery>(req));
  sendSuccess(res, { message: 'Introductions fetched', data });
};

export const sendIntroduction = async (req: Request, res: Response) => {
  const data = await adminService.sendIntroduction(adminOf(req), introIdOf(req));
  sendSuccess(res, { message: 'Introduction sent', data });
};

export const recordResponse = async (req: Request, res: Response) => {
  const data = await adminService.recordResponse(adminOf(req), introIdOf(req), req.body);
  sendSuccess(res, { message: 'Response recorded', data });
};

export const discardIntroduction = async (req: Request, res: Response) => {
  await adminService.discardIntroduction(adminOf(req), introIdOf(req));
  sendSuccess(res, { message: 'Introduction discarded' });
};

export const listCompanies = async (req: Request, res: Response) => {
  const data = await adminService.listCompanies(queryOf<{ page: number }>(req).page);
  sendSuccess(res, { message: 'Companies fetched', data });
};

export const listUsers = async (req: Request, res: Response) => {
  const data = await adminService.listUsers(queryOf<{ page: number }>(req).page);
  sendSuccess(res, { message: 'Users fetched', data });
};

export const listActivity = async (req: Request, res: Response) => {
  const data = await adminService.listActivity(queryOf<ActivityQuery>(req));
  sendSuccess(res, { message: 'Activity fetched', data });
};
