import { z } from 'zod';

/** "a, b ,," → ["a", "b"]; để trống nghĩa là tắt nhà cung cấp đó */
const CsvList = z
  .string()
  .default('')
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

/**
 * Số proxy đứng trước server (TRUST_PROXY): "false" hoặc "0" là không có, "true" là 1, hoặc một số.
 * Cần đúng số này để lấy IP thật từ X-Forwarded-For (xem clientIp trong app.ts).
 */
const ProxyHops = z
  .string()
  .default('false')
  .transform((s, ctx) => {
    const v = s.trim().toLowerCase();
    if (v === '' || v === 'false') return 0;
    if (v === 'true') return 1;
    if (/^\d+$/.test(v) && Number(v) <= 10) return Number(v);
    ctx.addIssue({ code: 'custom', message: 'TRUST_PROXY phải là false, true hoặc số proxy đứng trước server (0 đến 10)' });
    return z.NEVER;
  });

const Env = z.object({
  // Không có giá trị mặc định: quên đặt ở production thì dev-login và /docs sẽ bị bật, nên bắt buộc ghi rõ
  NODE_ENV: z.enum(['development', 'test', 'production'], {
    error: 'NODE_ENV bắt buộc, phải là development, test hoặc production',
  }),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MONGODB_URI: z.string().startsWith('mongodb', 'MONGODB_URI phải bắt đầu bằng mongodb:// hoặc mongodb+srv://'),
  MONGODB_DB: z.string().min(1).default('llhq'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET cần ít nhất 32 ký tự'),
  JWT_ISSUER: z.string().min(1).default('llhq-api'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  // Đủ cho gói /v1/sync lớn nhất (500 bản mỗi loại, tối đa khoảng 476 KB); test/config.test.ts kiểm tra điều này
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(512_000),
  TRUST_PROXY: ProxyHops,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Bundle id của app iOS (aud trong id token Apple) */
  APPLE_CLIENT_IDS: CsvList,
  /** Client id OAuth của app iOS, Android, web (aud trong id token Google) */
  GOOGLE_CLIENT_IDS: CsvList,
  /** Origin được gọi API từ trình duyệt (bản web của app); "*" là mọi origin; để trống là tắt CORS */
  CORS_ORIGINS: CsvList,
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
    trustProxyHops: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    socialLogin: { apple: e.APPLE_CLIENT_IDS, google: e.GOOGLE_CLIENT_IDS },
    corsOrigins: e.CORS_ORIGINS,
  };
}

export type Config = ReturnType<typeof loadConfig>;
