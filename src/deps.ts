import type { Config } from './config.ts';
import type { Collections, WithTransaction } from './db/client.ts';
import type { Auth } from './lib/auth.ts';
import type { IdTokenVerifier } from './lib/idToken.ts';
import type { Logger } from './lib/logger.ts';
import type { RateLimiter } from './lib/rateLimit.ts';

/** Mọi thứ handler cần, truyền vào từ server.ts (hoặc bản giả trong test). */
export interface Deps {
  config: Config;
  logger: Logger;
  auth: Auth;
  /** Kiểm tra id token Apple, Google */
  idTokens: IdTokenVerifier;
  cols: Collections;
  /** Ghi nhiều collection theo kiểu được cả hoặc không được gì */
  withTransaction: WithTransaction;
  ping(): Promise<boolean>;
  limiters: { global: RateLimiter; auth: RateLimiter; admin: RateLimiter };
}
