import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Deps } from './deps.ts';
import { bearerToken } from './lib/auth.ts';
import { PREFLIGHT_HEADERS, applyCors } from './lib/cors.ts';
import { HttpError, readJson, send } from './lib/http.ts';
import type { Ctx } from './lib/router.ts';
import { buildRouter } from './routes/index.ts';

const REQUEST_ID_RE = /^[\w-]{8,64}$/;

/**
 * IP người dùng, dùng cho giới hạn tần suất.
 * Mỗi proxy nối IP mà nó nhận kết nối vào CUỐI X-Forwarded-For, nên sau `hops` proxy, IP thật là phần tử thứ
 * `hops` tính từ cuối. Các phần tử đứng trước do client tự ghi, không được tin: lấy phần tử đầu tiên thì kẻ gian
 * chỉ cần đổi header là vượt được giới hạn đăng nhập.
 */
export function clientIp(req: Pick<IncomingMessage, 'headers' | 'socket'>, hops: number): string {
  if (hops > 0) {
    const fwd = req.headers['x-forwarded-for'];
    const list = (Array.isArray(fwd) ? fwd.join(',') : (fwd ?? ''))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) return list[Math.max(0, list.length - hops)]!;
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
    const ip = clientIp(req, deps.config.trustProxyHops);
    // Đặt trước mọi thứ để cả phản hồi lỗi (429, 401…) cũng đọc được từ trình duyệt
    const corsAllowed = applyCors(req, res, deps.config.corsOrigins);

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

      // Preflight của trình duyệt; origin không được phép thì đi tiếp và nhận 405 như trước
      if (req.method === 'OPTIONS' && corsAllowed) {
        send(res, { status: 204, headers: { ...PREFLIGHT_HEADERS } });
        return;
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
      if (route.opts.admin && !limiters.admin.hit(`admin:${ip}`).allowed) {
        throw new HttpError(429, 'rate_limited', 'Gửi quá nhiều yêu cầu quản trị, thử lại sau ít phút');
      }

      let userId = '';
      if (route.opts.auth) {
        const token = bearerToken(req);
        if (!token) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập');
        userId = (await deps.auth.verify(token, 'access')).userId;

        // Token còn hạn nhưng tài khoản đã xóa (DELETE /v1/me) thì không được dùng tiếp,
        // tránh tạo lại dữ liệu mồ côi cho người dùng không còn tồn tại
        const user = await deps.cols.users.findOne({ _id: userId }, { projection: { role: 1 } });
        if (!user) throw new HttpError(401, 'invalid_token', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
        // Không tin vào token: quyền admin có thể bị thu hồi bất cứ lúc nào trong database
        if (route.opts.admin && user.role !== 'admin') {
          throw new HttpError(403, 'forbidden', 'Không có quyền truy cập');
        }
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
