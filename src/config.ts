import { z } from 'zod';

/** "a, b ,," → ["a", "b"]; để trống nghĩa là tắt nhà cung cấp đó */
const CsvList = z
  .string()
  .default('')
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MONGODB_URI: z.string().startsWith('mongodb', 'MONGODB_URI phải bắt đầu bằng mongodb:// hoặc mongodb+srv://'),
  MONGODB_DB: z.string().min(1).default('llhq'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET cần ít nhất 32 ký tự'),
  JWT_ISSUER: z.string().min(1).default('llhq-api'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(100_000),
  TRUST_PROXY: z.stringbool().default(false),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Bundle id của app iOS (aud trong id token Apple) */
  APPLE_CLIENT_IDS: CsvList,
  /** Client id OAuth của app iOS, Android, web (aud trong id token Google) */
  GOOGLE_CLIENT_IDS: CsvList,
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    mongo: { uri: e.MONGODB_URI, db: e.MONGODB_DB },
    jwt: {
      secret: e.JWT_SECRET,
      issuer: e.JWT_ISSUER,
      accessTtlSec: e.ACCESS_TOKEN_TTL,
      refreshTtlSec: e.REFRESH_TOKEN_TTL,
    },
    bodyLimitBytes: e.BODY_LIMIT_BYTES,
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    socialLogin: { apple: e.APPLE_CLIENT_IDS, google: e.GOOGLE_CLIENT_IDS },
  };
}

export type Config = ReturnType<typeof loadConfig>;
