// CORS cho bản web của app (Expo web chạy trên trình duyệt, khác origin với API).
// App iOS, Android không gửi Origin nên không bị ảnh hưởng. Token đi qua header Authorization,
// không dùng cookie, nên không bật allow-credentials.
import type { IncomingMessage, ServerResponse } from 'node:http';

export const PREFLIGHT_HEADERS: Readonly<Record<string, string>> = {
  'access-control-allow-methods': 'GET, POST, PUT, DELETE',
  'access-control-allow-headers': 'authorization, content-type, x-request-id',
  'access-control-max-age': '600',
};

/**
 * Đặt header CORS nếu Origin của request nằm trong danh sách cho phép ("*" là mọi origin).
 * Trả true khi origin được phép, để app.ts trả lời preflight OPTIONS.
 */
export function applyCors(req: IncomingMessage, res: ServerResponse, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return false;
  const origin = req.headers.origin;
  if (!origin) return false;
  res.setHeader('vary', 'Origin');
  if (!allowed.includes('*') && !allowed.includes(origin)) return false;
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-expose-headers', 'x-request-id');
  return true;
}
