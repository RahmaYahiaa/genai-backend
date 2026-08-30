import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createApp } from './app.js';

async function main() {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`GenAI backend listening on port ${config.port} [${config.env}]`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection, exiting');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception, exiting');
  process.exit(1);
});

main().catch((error) => {
  logger.error({ error }, 'Fatal startup error');
  process.exit(1);
});
