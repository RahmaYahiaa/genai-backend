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
  LLM_PROVIDER: z.enum(['groq', 'anthropic']).default('groq'),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_MAX_TOKENS: z.coerce.number().int().positive().default(2500),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().default('google/gemini-3.8-flash'),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  TRANSCRIPTION_PROVIDER: z.enum(['groq']).default('groq'),
  GROQ_TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3-turbo'),

  EMBEDDING_PROVIDER: z.enum(['gemini']).default('gemini'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().min(64).max(4096).default(768),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_EMBED_MODEL: z.string().default('gemini-embedding-001'),

  ASSESSMENT_ENGINE_ENABLED: z.enum(['true', 'false']).default('true'),
  ASSESSMENT_ENGINE_URL: z.string().min(1).default('http://localhost:8002'),

  // Trusted external academic discovery (EDUNation parity). Disabled without
  // a TAVILY key: callers degrade to an explicit "unavailable" state.
  WEB_SEARCH_ENABLED: z.enum(['true', 'false']).default('true'),
  TAVILY_API_KEY: z.string().default(''),
  TRUST_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),

  // Generated learning-resource artifacts (SVG diagrams, PPTX decks).
  ARTIFACTS_DIR: z.string().min(1).default('data/artifacts'),

  // LeRna (Academic OS) AI service integration: the existing backend is the
  // only client of this internal service and forwards X-Student-Id only.
  LERNA_ENABLED: z.enum(['true', 'false']).default('false'),
  LERNA_API_URL: z.string().min(1).default('http://127.0.0.1:8000'),
  LERNA_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  // Tutor chat has a local fallback, so it gives up sooner than other AI calls.
  LERNA_TUTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  LERNA_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),

  CHUNK_MAX_CHARS: z.coerce.number().int().min(200).max(8000).default(1200),
  CHUNK_OVERLAP_CHARS: z.coerce.number().int().min(0).max(1000).default(150),
  VECTOR_SEARCH_MODE: z.enum(['auto', 'atlas', 'fallback']).default('auto'),
  ATLAS_VECTOR_INDEX_NAME: z.string().default('material_chunks_vector'),

  UPLOADS_DIR: z.string().min(1).default('uploads'),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  // General budget per signed-in user (anonymous traffic: per IP, 1/3 of it).
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),
  // Multiplies every per-endpoint limit (e.g. 10 for load tests / seeding).
  RATE_LIMIT_MULTIPLIER: z.coerce.number().positive().default(1),
  RATE_LIMIT_DISABLED: z.enum(['true', 'false']).default('false'),
  // Optional: shared rate-limit counters across instances (e.g. redis://default:pass@host:6379).
  REDIS_URL: z.string().optional(),

  // Outgoing email (Gmail SMTP by default: use a Google App Password).
  // Without SMTP_USER/SMTP_PASS emails are printed to the server log (dev).
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.enum(['true', 'false']).default('true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  APP_NAME: z.string().default('Lerna'),
  // Public address of the web app, used for links inside emails (invitations...).
  APP_URL: z.string().url().default('http://localhost:3000'),
  INVITATION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  EMAIL_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),

  AUTH_FAILED_ATTEMPTS_LIMIT: z.coerce.number().int().positive().default(10),
});

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);
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
    llmProvider: rawConfig.LLM_PROVIDER,
    groqApiKey: rawConfig.GROQ_API_KEY,
    groqModel: rawConfig.GROQ_MODEL,
    groqMaxTokens: rawConfig.GROQ_MAX_TOKENS,
    openrouterApiKey: rawConfig.OPENROUTER_API_KEY,
    openrouterModel: rawConfig.OPENROUTER_MODEL,
    openrouterBaseUrl: rawConfig.OPENROUTER_BASE_URL,
    transcriptionProvider: rawConfig.TRANSCRIPTION_PROVIDER,
    groqTranscriptionModel: rawConfig.GROQ_TRANSCRIPTION_MODEL,
    embeddingProvider: rawConfig.EMBEDDING_PROVIDER,
    embeddingDimensions: rawConfig.EMBEDDING_DIMENSIONS,
    geminiApiKey: rawConfig.GEMINI_API_KEY,
    geminiEmbedModel: rawConfig.GEMINI_EMBED_MODEL,
  },

  chunk: {
    maxChars: rawConfig.CHUNK_MAX_CHARS,
    overlapChars: rawConfig.CHUNK_OVERLAP_CHARS,
  },

  vector: {
    searchMode: rawConfig.VECTOR_SEARCH_MODE,
    atlasIndexName: rawConfig.ATLAS_VECTOR_INDEX_NAME,
  },

  uploads: {
    dir: rawConfig.UPLOADS_DIR,
  },

  assessmentEngine: {
    enabled: rawConfig.ASSESSMENT_ENGINE_ENABLED === 'true',
    apiUrl: rawConfig.ASSESSMENT_ENGINE_URL.replace(/\/+$/, ''),
  },

  webSearch: {
    // On by default whenever a Tavily key is configured; set WEB_SEARCH_ENABLED=false to opt out.
    enabled: rawConfig.WEB_SEARCH_ENABLED !== 'false',
    tavilyApiKey: rawConfig.TAVILY_API_KEY,
    trustThreshold: rawConfig.TRUST_THRESHOLD,
  },

  artifacts: {
    dir: rawConfig.ARTIFACTS_DIR,
  },

  lerna: {
    enabled: rawConfig.LERNA_ENABLED === 'true',
    apiUrl: rawConfig.LERNA_API_URL.replace(/\/+$/, ''),
    timeoutMs: rawConfig.LERNA_TIMEOUT_MS,
    tutorTimeoutMs: rawConfig.LERNA_TUTOR_TIMEOUT_MS,
    probeTimeoutMs: rawConfig.LERNA_PROBE_TIMEOUT_MS,
  },

  rateLimit: {
    windowMinutes: rawConfig.RATE_LIMIT_WINDOW_MINUTES,
    maxRequests: rawConfig.RATE_LIMIT_MAX_REQUESTS,
    multiplier: rawConfig.RATE_LIMIT_MULTIPLIER,
    disabled: rawConfig.RATE_LIMIT_DISABLED === 'true',
    redisUrl: rawConfig.REDIS_URL || null,
  },

  mail: {
    host: rawConfig.SMTP_HOST,
    port: rawConfig.SMTP_PORT,
    secure: rawConfig.SMTP_SECURE === 'true',
    user: rawConfig.SMTP_USER || null,
    pass: rawConfig.SMTP_PASS ? rawConfig.SMTP_PASS.replace(/\s+/g, '') : null,
    from: rawConfig.MAIL_FROM || (rawConfig.SMTP_USER ? `${rawConfig.APP_NAME} <${rawConfig.SMTP_USER}>` : `${rawConfig.APP_NAME} <no-reply@localhost>`),
    appName: rawConfig.APP_NAME,
    appUrl: rawConfig.APP_URL.replace(/\/+$/, ''),
    invitationTtlDays: rawConfig.INVITATION_TTL_DAYS,
    codeTtlMinutes: rawConfig.EMAIL_CODE_TTL_MINUTES,
  },

  auth: {
    failedAttemptsLimit: rawConfig.AUTH_FAILED_ATTEMPTS_LIMIT,
  },
});