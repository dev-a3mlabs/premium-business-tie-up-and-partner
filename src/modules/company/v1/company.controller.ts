import type { Request, Response } from 'express';
import type { CompanyRequest } from '../../../middlewares/org-access.middleware.js';
import { sendSuccess } from '../../../utils/response.js';
import { companyService } from '../company.service.js';

const pageOf = (req: Request) => (req.query as unknown as { page: number }).page; // coerced by validate
const requestIdOf = (req: Request) => (req.params as { requestId: string }).requestId;

export const getDashboard = async (req: Request, res: Response) => {
  const { org } = req as CompanyRequest;
  const data = await companyService.getDashboard(org);
  sendSuccess(res, { message: 'Dashboard fetched', data });
};

export const getProfile = async (req: Request, res: Response) => {
  const { org } = req as CompanyRequest;
  sendSuccess(res, { message: 'Company profile fetched', data: companyService.getProfile(org) });
};

export const updateProfile = async (req: Request, res: Response) => {
  const { org, user } = req as CompanyRequest;
  const data = await companyService.updateProfile(org, user, req.body);
  sendSuccess(res, { message: 'Company profile updated', data });
};

export const createRequests = async (req: Request, res: Response) => {
  const { org, user } = req as CompanyRequest;
  const data = await companyService.createRequests(org, user, req.body);
  sendSuccess(res, { message: 'Requests submitted', data, statusCode: 201 });
};

export const listRequests = async (req: Request, res: Response) => {
  const { org } = req as CompanyRequest;
  const data = await companyService.listRequests(org, pageOf(req));
  sendSuccess(res, { message: 'Requests fetched', data });
};

export const getRequest = async (req: Request, res: Response) => {
  const { org } = req as CompanyRequest;
  const data = await companyService.getRequest(org, requestIdOf(req));
  sendSuccess(res, { message: 'Request fetched', data });
};

export const cancelRequest = async (req: Request, res: Response) => {
  const { org, user } = req as CompanyRequest;
  const data = await companyService.cancelRequest(org, user, requestIdOf(req));
  sendSuccess(res, { message: 'Request cancelled', data });
};

export const listIntroductions = async (req: Request, res: Response) => {
  const { org } = req as CompanyRequest;
  const data = await companyService.listIntroductions(org, pageOf(req));
  sendSuccess(res, { message: 'Introductions fetched', data });
};
