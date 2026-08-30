import mongoose from 'mongoose';
import { config } from './index.js';
import { logger } from './logger.js';

/**
 * Index auto-building is enabled outside production for convenience; in
 * production, indexes must be created through controlled migrations/reviewed
 * deploys so a rolling release never triggers index builds on hot collections.
 */
mongoose.set('autoIndex', !config.isProduction);

export async function connectDatabase() {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (error) => logger.error({ error }, 'MongoDB connection error'));

  await mongoose.connect(config.mongoUri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}
