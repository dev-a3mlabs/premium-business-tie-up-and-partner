import type { Request, Response } from 'express';
import type { AuthRequest } from '../../../middlewares/auth.middleware.js';
import { getClientInfo } from '../../../utils/request.js';
import { sendSuccess } from '../../../utils/response.js';
import { authService } from '../auth.service.js';

export const login = async (req: Request, res: Response) => {
  const data = await authService.login(req.body, getClientInfo(req));
  sendSuccess(res, { message: 'Login successful', data });
};

export const refresh = async (req: Request, res: Response) => {
  const data = await authService.refresh(req.body.refreshToken);
  sendSuccess(res, { message: 'Token refreshed', data });
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout((req as AuthRequest).sessionId);
  sendSuccess(res, { message: 'Logged out successfully' });
};

export const getSession = async (req: Request, res: Response) => {
  const data = await authService.getSession((req as AuthRequest).user);
  sendSuccess(res, { message: 'Session fetched', data });
};

export const registerCompany = async (req: Request, res: Response) => {
  const data = await authService.registerCompany(req.body, getClientInfo(req));
  sendSuccess(res, { message: 'Company registered successfully', data, statusCode: 201 });
};
