import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const dbUrl = new URL(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: decodeURIComponent(dbUrl.pathname.slice(1)),
  connectionLimit: 10,
  connectTimeout: 5000,
  acquireTimeout: 10000,
});

export const prisma = new PrismaClient({ adapter });

// Fails fast on startup if the database is unreachable.
export const connectDatabase = async () => {
  const target = `${dbUrl.hostname}:${dbUrl.port || 3306}/${decodeURIComponent(dbUrl.pathname.slice(1))}`;
  try {
    // $connect() is lazy with driver adapters; a transaction has to open a real connection.
    await prisma.$transaction(async () => {});
  } catch (err) {
    throw new Error(
      `Could not connect to MySQL at ${target}. Check that MySQL is running, the database exists, and DATABASE_URL is correct.`,
      { cause: err },
    );
  }
  logger.info(`Database connected (${target})`);
};
