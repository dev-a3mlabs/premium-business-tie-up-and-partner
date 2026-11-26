import { z } from 'zod';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { logger } from '../src/utils/logger.js';

const seedEnvSchema = z.object({
  PLATFORM_ADMIN_NAME: z.string().trim().min(2).max(120),
  PLATFORM_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email('PLATFORM_ADMIN_EMAIL must be a valid email')),
  PLATFORM_ADMIN_PASSWORD: z.string().min(8, 'PLATFORM_ADMIN_PASSWORD must be at least 8 characters'),
});

const seedPlatformAdmin = async () => {
  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error('Invalid seed environment variables:', z.flattenError(parsed.error).fieldErrors);
    process.exitCode = 1;
    return;
  }
  const { PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: PLATFORM_ADMIN_EMAIL }, select: { id: true } });
  if (existing) {
    logger.info(`Platform admin already exists (${PLATFORM_ADMIN_EMAIL}), skipping create`);
    return;
  }

  await prisma.user.create({
    data: {
      name: PLATFORM_ADMIN_NAME,
      email: PLATFORM_ADMIN_EMAIL,
      passwordHash: await hashPassword(PLATFORM_ADMIN_PASSWORD),
      isPlatformAdmin: true,
    },
  });
  logger.info(`Platform admin created (${PLATFORM_ADMIN_EMAIL})`);
};

seedPlatformAdmin()
  .catch((err) => {
    logger.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
