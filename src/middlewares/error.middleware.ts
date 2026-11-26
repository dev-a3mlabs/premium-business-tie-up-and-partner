import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../config/error-codes.js';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.message, err.code, err.details);
  }

  // Thrown by express.json() when the request body isn't valid JSON.
  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Invalid JSON in request body', ERROR_CODES.INVALID_JSON);
  }

  // A unique key hit by two requests racing past the service's own check.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return sendError(res, 409, 'Conflict', ERROR_CODES.CONFLICT);
  }

  logger.error(err);
  sendError(res, 500, 'Internal server error', ERROR_CODES.INTERNAL_ERROR);
};
