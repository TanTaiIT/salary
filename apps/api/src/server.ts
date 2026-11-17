import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { connectMongo, ensureIndexes, getCollections } from './db/client.ts';
import { createAuth } from './lib/auth.ts';
import { createLogger } from './lib/logger.ts';
import { RateLimiter } from './lib/rateLimit.ts';

const config = loadConfig();
const logger = createLogger(config.logLevel);

const { client, db } = await connectMongo(config.mongo.uri, config.mongo.db);
const cols = getCollections(db);
await ensureIndexes(cols);
logger.info('mongodb connected', { db: config.mongo.db });

const limiters = {
  global: new RateLimiter(300, 60_000), // 300 yêu cầu/phút mỗi IP
  auth: new RateLimiter(10, 60_000), // 10 lần đăng nhập/phút mỗi IP
};

const app = createApp({
  config,
  logger,
  cols,
  limiters,
  auth: createAuth(config.jwt),
  ping: async () => (await db.command({ ping: 1 })).ok === 1,
});

const server = createServer(app);
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

server.listen(config.port, config.host, () => {
  logger.info('server listening', { host: config.host, port: config.port, env: config.env, node: process.version });
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutting down', { signal });

  // Quá 10 giây mà chưa đóng xong thì buộc thoát
  setTimeout(() => {
    logger.error('forced shutdown');
    process.exit(1);
  }, 10_000).unref();

  server.close();
  server.closeIdleConnections();
  await new Promise<void>((resolve) => server.once('close', () => resolve()));
  limiters.global.close();
  limiters.auth.close();
  await client.close();
  logger.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  logger.error('unhandledRejection', { err });
  void shutdown('unhandledRejection');
});
