import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessTokenPayload = {
  sub: string; // user uuid
  sid: string; // session uuid
  type: 'access';
};

export const signAccessToken = (payload: Omit<AccessTokenPayload, 'type'>) =>
  jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

export const generateRefreshToken = () => randomBytes(48).toString('base64url');

// Only the hash is stored, so a leaked DB can't be used to log in.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
