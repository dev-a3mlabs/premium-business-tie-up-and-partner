import { ERROR_CODES, type ErrorCode } from '../config/error-codes.js';

export type ErrorDetail = {
  field?: string;
  message: string;
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static validation(details: ErrorDetail[]) {
    return new ApiError(400, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, details);
  }

  static badRequest(message = 'Bad request', code: ErrorCode = ERROR_CODES.BAD_REQUEST) {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = 'Unauthorized', code: ErrorCode = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'Forbidden', code: ErrorCode = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Not found', code: ErrorCode = ERROR_CODES.NOT_FOUND) {
    return new ApiError(404, message, code);
  }

  static conflict(message = 'Conflict', code: ErrorCode = ERROR_CODES.CONFLICT) {
    return new ApiError(409, message, code);
  }

  static tooManyRequests(message = 'Too many requests', code: ErrorCode = ERROR_CODES.TOO_MANY_REQUESTS) {
    return new ApiError(429, message, code);
  }
}
