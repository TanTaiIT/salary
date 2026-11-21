import type { IncomingMessage, ServerResponse } from 'node:http';
import type { z } from 'zod';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface Reply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export const ok = (body: unknown): Reply => ({ status: 200, body });
export const created = (body: unknown): Reply => ({ status: 201, body });
export const noContent = (): Reply => ({ status: 204 });

/** Đọc body JSON, giới hạn kích thước để không bị gửi dữ liệu khổng lồ làm treo server. */
export async function readJson(req: IncomingMessage, limitBytes: number): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type phải là application/json');
  }
  const tooLarge = () => new HttpError(413, 'payload_too_large', `Dữ liệu gửi lên vượt quá ${limitBytes} byte`);
  if (Number(req.headers['content-length'] ?? 0) > limitBytes) throw tooLarge();

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limitBytes) throw tooLarge();
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) throw new HttpError(400, 'empty_body', 'Thiếu dữ liệu gửi lên');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Dữ liệu không phải JSON hợp lệ');
  }
}

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw new HttpError(422, 'validation_failed', 'Dữ liệu không hợp lệ', details);
  }
  return r.data;
}

export function send(res: ServerResponse, reply: Reply): void {
  res.statusCode = reply.status;
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(reply.headers ?? {})) res.setHeader(k, v);
  if (reply.body === undefined || reply.status === 204) {
    res.end();
    return;
  }
  const json = JSON.stringify(reply.body);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(json));
  res.end(json);
}
