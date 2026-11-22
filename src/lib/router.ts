import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, type Reply } from './http.ts';
import type { Deps } from '../deps.ts';

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  query: URLSearchParams;
  requestId: string;
  ip: string;
  /** Có giá trị khi route yêu cầu đăng nhập */
  userId: string;
  deps: Deps;
  body(): Promise<unknown>;
}

export type Handler = (ctx: Ctx) => Promise<Reply> | Reply;

export interface RouteOptions {
  /** Mặc định true: route cần access token */
  auth?: boolean;
  /** Bộ giới hạn tần suất riêng, ngoài giới hạn chung */
  limiter?: 'auth';
  /** Cần đăng nhập và users.role = "admin" trong database; có giới hạn tần suất riêng */
  admin?: boolean;
}

interface Route {
  method: string;
  /** Đường dẫn khai báo, ví dụ /v1/work-days/:id */
  path: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
  opts: Required<Pick<RouteOptions, 'auth'>> & RouteOptions;
}

export type Match =
  | { kind: 'found'; route: Route; params: Record<string, string> }
  | { kind: 'method_not_allowed'; allowed: string[] }
  | { kind: 'not_found' };

/** Router tối giản: hỗ trợ tham số dạng /work-days/:id */
export class Router {
  #routes: Route[] = [];

  add(method: string, path: string, handler: Handler, opts: RouteOptions = {}): this {
    const keys: string[] = [];
    const pattern = path
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.#routes.push({
      method: method.toUpperCase(),
      path,
      regex: new RegExp(`^${pattern}/?$`),
      keys,
      handler,
      // Route admin luôn cần đăng nhập, kể cả khi lỡ khai báo auth: false
      opts: { ...opts, auth: opts.admin ? true : (opts.auth ?? true) },
    });
    return this;
  }

  get(path: string, h: Handler, o?: RouteOptions) { return this.add('GET', path, h, o); }
  post(path: string, h: Handler, o?: RouteOptions) { return this.add('POST', path, h, o); }
  put(path: string, h: Handler, o?: RouteOptions) { return this.add('PUT', path, h, o); }
  delete(path: string, h: Handler, o?: RouteOptions) { return this.add('DELETE', path, h, o); }

  /** Mọi route đã khai báo (dùng để kiểm tra tài liệu OpenAPI khớp với route thật) */
  list(): { method: string; path: string; auth: boolean; admin: boolean }[] {
    return this.#routes.map((r) => ({ method: r.method, path: r.path, auth: r.opts.auth, admin: !!r.opts.admin }));
  }

  match(method: string, pathname: string): Match {
    const allowed: string[] = [];
    for (const route of this.#routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      if (route.method !== method) {
        allowed.push(route.method);
        continue;
      }
      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        try {
          params[key] = decodeURIComponent(m[i + 1] ?? '');
        } catch {
          throw new HttpError(400, 'bad_path', 'Đường dẫn không hợp lệ');
        }
      });
      return { kind: 'found', route, params };
    }
    return allowed.length ? { kind: 'method_not_allowed', allowed } : { kind: 'not_found' };
  }
}
