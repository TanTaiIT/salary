import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Deps } from './deps.ts';
import { bearerToken } from './lib/auth.ts';
import { HttpError, readJson, send } from './lib/http.ts';
import type { Ctx } from './lib/router.ts';
import { buildRouter } from './routes/index.ts';

const REQUEST_ID_RE = /^[\w-]{8,64}$/;

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Tạo hàm xử lý request cho http.createServer. Tách khỏi server.ts để test không cần mở cổng thật hay MongoDB. */
export function createApp(deps: Deps) {
  const router = buildRouter(deps.config.env);
  const { logger, limiters } = deps;

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = performance.now();
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && REQUEST_ID_RE.test(incomingId) ? incomingId : randomUUID();
    res.setHeader('x-request-id', requestId);

    const url = new URL(req.url ?? '/', 'http://localhost');
    const ip = clientIp(req, deps.config.trustProxy);

    res.once('finish', () => {
      logger.info('request', {
        requestId,
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        ms: Math.round(performance.now() - started),
      });
    });

    try {
      const limit = limiters.global.hit(ip);
      if (!limit.allowed) {
        throw new HttpError(429, 'rate_limited', 'Gửi quá nhiều yêu cầu, thử lại sau ít phút');
      }

      const match = router.match(req.method ?? 'GET', url.pathname);
      if (match.kind === 'not_found') throw new HttpError(404, 'not_found', 'Không tìm thấy đường dẫn');
      if (match.kind === 'method_not_allowed') {
        res.setHeader('allow', match.allowed.join(', '));
        throw new HttpError(405, 'method_not_allowed', 'Phương thức không được hỗ trợ');
      }

      const { route, params } = match;
      if (route.opts.limiter === 'auth' && !limiters.auth.hit(`auth:${ip}`).allowed) {
        throw new HttpError(429, 'rate_limited', 'Thử đăng nhập quá nhiều lần, đợi một lát rồi thử lại');
      }

      let userId = '';
      if (route.opts.auth) {
        const token = bearerToken(req);
        if (!token) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập');
        userId = await deps.auth.verify(token, 'access');
      }

      let bodyPromise: Promise<unknown> | undefined;
      const ctx: Ctx = {
        req,
        res,
        url,
        params,
        query: url.searchParams,
        requestId,
        ip,
        userId,
        deps,
        body: () => (bodyPromise ??= readJson(req, deps.config.bodyLimitBytes)),
      };

      send(res, await route.handler(ctx));
    } catch (err) {
      if (res.headersSent) {
        logger.error('error after headers sent', { requestId, err });
        res.destroy();
        return;
      }
      if (err instanceof HttpError) {
        // Body chưa đọc hết thì đóng kết nối, tránh phần còn lại bị hiểu nhầm là request tiếp theo
        if (err.status === 413) res.setHeader('connection', 'close');
        send(res, {
          status: err.status,
          body: { error: { code: err.code, message: err.message, details: err.details }, requestId },
        });
        return;
      }
      logger.error('unhandled error', { requestId, err });
      send(res, { status: 500, body: { error: { code: 'internal_error', message: 'Lỗi máy chủ' }, requestId } });
    }
  };
}
