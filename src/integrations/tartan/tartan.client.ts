import axios, { isAxiosError } from 'axios';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { ERROR_CODES } from '../../config/error-codes.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

export type VerificationRequest = {
  category: string;
  type: string;
  data: Record<string, string>;
};

// Renew the token a minute before it expires so it never runs out mid-request.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

// Statuses that mean the number itself was rejected, not that the service failed.
const REJECTED_INPUT_STATUSES = [400, 404, 422];

const http = axios.create({
  baseURL: env.TARTAN_BASE_URL,
  timeout: env.TARTAN_TIMEOUT_MS,
  headers: { 'x-api-key': env.TARTAN_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' },
});

let cachedToken: { value: string; expiresAt: number } | null = null;
let pendingToken: Promise<string> | null = null;

// Login failures are rethrown as plain errors so they are never mistaken for a rejected number.
const authenticate = async () => {
  const { data } = await http
    .post<{ token: string }>('/api/auth/v1/authenticate', {
      username: env.TARTAN_USERNAME,
      password: env.TARTAN_PASSWORD,
    })
    .catch((err) => {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      throw new Error(`Tartan authentication failed (${status ?? (err as Error).message})`);
    });
  const exp = (jwt.decode(data.token) as jwt.JwtPayload | null)?.exp ?? 0;
  cachedToken = { value: data.token, expiresAt: exp * 1000 - TOKEN_EXPIRY_MARGIN_MS };
  return data.token;
};

// Concurrent callers share one login instead of each requesting a token.
const getToken = () => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return Promise.resolve(cachedToken.value);
  pendingToken ??= authenticate().finally(() => {
    pendingToken = null;
  });
  return pendingToken;
};

const send = async <T>(request: VerificationRequest) => {
  const { data } = await http.post<T>(
    '/external/v1/verification',
    { ...request, applicationId: randomUUID() },
    { headers: { Authorization: `Bearer ${await getToken()}` } },
  );
  return data;
};

export const tartanClient = {
  // Resolves to null when the number is rejected; throws when the service can't be reached.
  verify: async <T>(request: VerificationRequest): Promise<T | null> => {
    try {
      // One retry: with a fresh token if the current one was revoked early, or after a passing server error.
      return await send<T>(request).catch((err) => {
        const status = isAxiosError(err) ? (err.response?.status ?? 0) : 0;
        if (status !== 401 && status < 500) throw err;
        if (status === 401) cachedToken = null;
        return send<T>(request);
      });
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const reason = isAxiosError(err) ? err.response?.data?.message : undefined;
      if (status && REJECTED_INPUT_STATUSES.includes(status)) {
        logger.warn('Tartan rejected verification', { type: request.type, status, reason });
        return null;
      }
      logger.error('Tartan verification failed', { type: request.type, status, reason, error: (err as Error).message });
      throw ApiError.serviceUnavailable(
        'Verification is unavailable right now. Please try again shortly.',
        ERROR_CODES.VERIFICATION_UNAVAILABLE,
      );
    }
  },
};
