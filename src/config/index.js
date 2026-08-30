import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment variable schema. The application fails fast at boot when any
 * required variable is missing or malformed, so misconfiguration never
 * reaches runtime silently.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('*'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  ENABLE_SWAGGER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  MONGODB_URI: z.string().refine((value) => /^mongodb(\+srv)?:\/\//.test(value), {
    message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
  }),
  DB_NAME: z.string().default('genai'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_ACCESS_EXPIRES_IN must look like "15m", "1h", "7d"')
    .default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_REFRESH_EXPIRES_IN must look like "15m", "1h", "7d"')
    .default('7d'),
  JWT_BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(16).default(12),

  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(4096),

  EMBEDDING_PROVIDER: z.string().default('voyage'),
  EMBEDDING_MODEL: z.string().default('voyage-3-lite'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1024),
  VOYAGE_API_KEY: z.string().default(''),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),

    AUTH_FAILED_ATTEMPTS_LIMIT: z.coerce.number().int().positive().default(10),
});

function parseEnv() {
  const env = typeof globalThis !== 'undefined' && globalThis.process ? globalThis.process.env : {};
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration. Fix the following before starting:\n${issues}\n` +
        'Hint: copy .env.example to .env and generate secrets with `openssl rand -hex 32`.',
    );
  }
  return parsed.data;
}

const rawConfig = parseEnv();

function parseCorsOrigins(corsOrigin) {
  if (corsOrigin === '*') return true;
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = Object.freeze({
  env: rawConfig.NODE_ENV,
  isProduction: rawConfig.NODE_ENV === 'production',
  port: rawConfig.PORT,
  corsOrigins: parseCorsOrigins(rawConfig.CORS_ORIGIN),

  logLevel: rawConfig.LOG_LEVEL,
  logPretty: rawConfig.LOG_PRETTY,
  enableSwagger: rawConfig.ENABLE_SWAGGER,

  mongoUri: rawConfig.MONGODB_URI,
  dbName: rawConfig.DB_NAME,

  jwt: {
    accessSecret: rawConfig.JWT_ACCESS_SECRET,
    accessExpiresIn: rawConfig.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: rawConfig.JWT_REFRESH_SECRET,
    refreshExpiresIn: rawConfig.JWT_REFRESH_EXPIRES_IN,
    bcryptRounds: rawConfig.JWT_BCRYPT_ROUNDS,
  },

  ai: {
    anthropicApiKey: rawConfig.ANTHROPIC_API_KEY,
    anthropicModel: rawConfig.ANTHROPIC_MODEL,
    anthropicMaxTokens: rawConfig.ANTHROPIC_MAX_TOKENS,
    embeddingProvider: rawConfig.EMBEDDING_PROVIDER,
    embeddingModel: rawConfig.EMBEDDING_MODEL,
    embeddingDimensions: rawConfig.EMBEDDING_DIMENSIONS,
    voyageApiKey: rawConfig.VOYAGE_API_KEY,
  },

  rateLimit: {
    windowMinutes: rawConfig.RATE_LIMIT_WINDOW_MINUTES,
    maxRequests: rawConfig.RATE_LIMIT_MAX_REQUESTS,
  },

  auth: {
    failedAttemptsLimit: rawConfig.AUTH_FAILED_ATTEMPTS_LIMIT,
  },
});
