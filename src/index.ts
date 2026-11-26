import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './db/prisma.js';
import { logger } from './utils/logger.js';

const start = async () => {
  await connectDatabase();

  app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`);
  });
};

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
