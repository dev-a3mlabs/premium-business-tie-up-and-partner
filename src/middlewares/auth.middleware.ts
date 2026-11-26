import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '../config/error-codes.js';
import type { User } from '../generated/prisma/client.js';
import { authRepository } from '../modules/auth/auth.repository.js';
import { isSessionActive, isUserActive } from '../modules/auth/auth.service.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/token.js';

export type AuthRequest = Request & { user: User; sessionId: number };

// Verifies the access token, then that its session and user are still active in the DB.
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is required');
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(header.slice('Bearer '.length));
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw ApiError.unauthorized('Invalid access token', ERROR_CODES.INVALID_TOKEN);
  }

  if (payload.type !== 'access') {
    throw ApiError.unauthorized('Invalid access token', ERROR_CODES.INVALID_TOKEN);
  }

  const session = await authRepository.findSessionByUuid(payload.sid);
  if (!session || !isSessionActive(session) || session.user.uuid !== payload.sub || !isUserActive(session.user)) {
    throw ApiError.unauthorized('Invalid access token', ERROR_CODES.INVALID_TOKEN);
  }

  Object.assign(req, { user: session.user, sessionId: session.id });
  next();
};

export const requirePlatformAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!(req as AuthRequest).user.isPlatformAdmin) {
    throw ApiError.forbidden('You do not have permission to do this');
  }
  next();
};
