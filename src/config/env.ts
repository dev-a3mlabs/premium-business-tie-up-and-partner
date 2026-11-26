import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  SESSION_MAX_HOURS: z.coerce.number().int().positive().default(336),
  TARTAN_BASE_URL: z.url().default('https://api-ext-prod.tartanhq.com/aphrodite'),
  TARTAN_API_KEY: z.string().min(1, 'TARTAN_API_KEY is required'),
  TARTAN_USERNAME: z.string().min(1, 'TARTAN_USERNAME is required'),
  TARTAN_PASSWORD: z.string().min(1, 'TARTAN_PASSWORD is required'),
  TARTAN_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
