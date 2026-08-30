import pino from 'pino';
import { config } from './index.js';

export const logger = pino({
  level: config.logLevel,
  base: { service: 'genai-backend', env: config.env },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  ...(config.logPretty && !config.isProduction
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service,env',
          },
        },
      }
    : {}),
});
