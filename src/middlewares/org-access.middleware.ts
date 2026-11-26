import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import type { MembershipRole, Organization } from '../generated/prisma/client.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthRequest } from './auth.middleware.js';

export type CompanyRequest = AuthRequest & { org: Organization; membershipRole: MembershipRole };

// Looks the org up only among the caller's memberships, so another company's org is the same 404 as a missing one.
export const requireMembership = async (req: Request, _res: Response, next: NextFunction) => {
  const { user } = req as AuthRequest;
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, org: { uuid: String(req.params.orgId) } },
    include: { org: true },
  });
  if (!membership) {
    throw ApiError.notFound('Company not found');
  }

  Object.assign(req, { org: membership.org, membershipRole: membership.role });
  next();
};

export const requireOrgRole =
  (...roles: MembershipRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes((req as CompanyRequest).membershipRole)) {
      throw ApiError.forbidden('You do not have permission to do this');
    }
    next();
  };
