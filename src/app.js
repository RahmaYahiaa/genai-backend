import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { ERROR_CODES } from './config/constants.js';
import { requestContext } from './api/v1/middlewares/request-context.middleware.js';
import { notFoundHandler } from './api/v1/middlewares/not-found.middleware.js';
import { errorHandler } from './api/v1/middlewares/error.middleware.js';
import v1Router from './api/v1/routes/index.js';
import docsRouter from './api/v1/docs/swagger.routes.js';

export function createApp() {
  const app = express();

  // Behind load balancers/proxies; required for correct client IPs in rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Correlation id first so every log line (including http) carries it.
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customProps: (req) => ({ requestId: req.id }),
      autoLogging: {
        ignore: (req) => req.url === '/api/v1/health' || req.url === '/api/docs.json',
      },
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' },
    }),
  );

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  const globalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMinutes * 60 * 1000,
    limit: config.rateLimit.maxRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests, please slow down.',
          requestId: req.id,
        },
      });
    },
  });
  app.use('/api', globalLimiter);

  app.use('/api/v1', v1Router);
  if (config.enableSwagger) {
    app.use('/api', docsRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
