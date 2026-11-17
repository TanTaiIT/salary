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
}

interface Route {
  method: string;
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
      regex: new RegExp(`^${pattern}/?$`),
      keys,
      handler,
      opts: { auth: true, ...opts },
    });
    return this;
  }

  get(path: string, h: Handler, o?: RouteOptions) { return this.add('GET', path, h, o); }
  post(path: string, h: Handler, o?: RouteOptions) { return this.add('POST', path, h, o); }
  put(path: string, h: Handler, o?: RouteOptions) { return this.add('PUT', path, h, o); }
  delete(path: string, h: Handler, o?: RouteOptions) { return this.add('DELETE', path, h, o); }

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
