import type { Config } from './config.ts';
import type { Collections } from './db/client.ts';
import type { Auth } from './lib/auth.ts';
import type { Logger } from './lib/logger.ts';
import type { RateLimiter } from './lib/rateLimit.ts';

/** Mọi thứ handler cần, truyền vào từ server.ts (hoặc bản giả trong test). */
export interface Deps {
  config: Config;
  logger: Logger;
  auth: Auth;
  cols: Collections;
  ping(): Promise<boolean>;
  limiters: { global: RateLimiter; auth: RateLimiter };
}
