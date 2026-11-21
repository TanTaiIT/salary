import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import type { Collections } from '../src/db/client.ts';
import type { Deps } from '../src/deps.ts';
import { createAuth } from '../src/lib/auth.ts';
import { createIdTokenVerifier } from '../src/lib/idToken.ts';
import { silentLogger } from '../src/lib/logger.ts';
import { RateLimiter } from '../src/lib/rateLimit.ts';

export const config = loadConfig({
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://unused',
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  BODY_LIMIT_BYTES: '1000',
});

/** Mở server thật trên cổng ngẫu nhiên, với MongoDB giả (các test này không chạm DB). */
export async function startTestServer(overrides: Partial<Deps> = {}) {
  const limiters = {
    global: new RateLimiter(1000, 60_000),
    auth: new RateLimiter(3, 60_000),
    admin: new RateLimiter(1000, 60_000),
  };
  const deps: Deps = {
    config,
    logger: silentLogger,
    auth: createAuth(config.jwt),
    // Mặc định chưa cấu hình Apple, Google (route trả 503); test đăng nhập truyền bộ kiểm tra với khóa cục bộ
    idTokens: createIdTokenVerifier({}),
    // Mặc định mọi userId đều là người dùng thường đang tồn tại; test cần DB riêng thì truyền cols
    cols: { users: { findOne: async (f: { _id: string }) => ({ _id: f._id, role: 'user' }) } } as unknown as Collections,
    // Bản giả không có transaction; test tích hợp truyền transactionRunner của MongoDB thật
    withTransaction: (fn) => fn(undefined),
    ping: async () => true,
    limiters,
    ...overrides,
  };
  const server: Server = createServer(createApp(deps));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    deps,
    base: `http://127.0.0.1:${port}`,
    async close() {
      limiters.global.close();
      limiters.auth.close();
      limiters.admin.close();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}

export const json = (res: Response): Promise<any> => res.json();
