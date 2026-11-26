import type { Response } from 'express';
import type { ErrorCode } from '../config/error-codes.js';
import type { ErrorDetail } from './ApiError.js';

type SuccessOptions = {
  message: string;
  data?: unknown;
  meta?: Record<string, unknown>;
  statusCode?: number;
};

// Every API responds through these two, so the shape is the same everywhere.
export const sendSuccess = (res: Response, { message, data = null, meta, statusCode = 200 }: SuccessOptions) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta && { meta }),
  });

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  code: ErrorCode,
  details?: ErrorDetail[],
) =>
  res.status(statusCode).json({
    success: false,
    message,
    error: { code, ...(details && { details }) },
  });
