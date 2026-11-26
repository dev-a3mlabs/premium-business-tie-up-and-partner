import type { Request } from 'express';

export type ClientInfo = {
  ipAddress: string | null;
  userAgent: string | null;
};

export const getClientInfo = (req: Request): ClientInfo => ({
  ipAddress: req.ip ?? null,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});
