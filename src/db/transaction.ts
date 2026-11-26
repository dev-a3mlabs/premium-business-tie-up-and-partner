import { Prisma } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// READ COMMITTED so a re-read after locking a row sees what the transaction that held the lock committed.
export const withTransaction = <T>(fn: (tx: TxClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
