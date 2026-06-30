import { startServer } from './server/index.js';
import { resumeSessions } from './bot/connection.js';
import { config } from './config.js';
import { logger } from './logger.js';
import './database/index.js';

logger.info(`Orin by Chris`);
logger.info(`Version: 1.0.0`);
logger.info(`Prefix: ${config.prefix}`);
logger.info(`Owner Number: ${config.ownerNumber}`);
logger.info(`Admin Contact: ${config.adminContact}`);

startServer();
resumeSessions();

process.on('SIGINT', () => {
  logger.info('Shutting down Orin');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down Orin');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception');
});
