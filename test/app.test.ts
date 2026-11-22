import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Collections } from '../src/db/client.ts';
import { config, json, startTestServer } from './helpers.ts';

describe('HTTP cơ bản', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => { t = await startTestServer(); });
  after(async () => { await t.close(); });

  test('GET /health trả 200 và có x-request-id', async () => {
    const res = await fetch(`${t.base}/health`);
    assert.equal(res.status, 200);
    assert.equal((await json(res)).status, 'ok');
    assert.ok(res.headers.get('x-request-id'));
  });

  test('đường dẫn không tồn tại trả 404 dạng JSON', async () => {
    const res = await fetch(`${t.base}/khong-co`);
    assert.equal(res.status, 404);
    assert.equal((await json(res)).error.code, 'not_found');
  });

  test('sai phương thức trả 405 kèm header Allow', async () => {
    const res = await fetch(`${t.base}/health`, { method: 'DELETE' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET');
  });

  test('route cần đăng nhập trả 401 khi thiếu token', async () => {
    const res = await fetch(`${t.base}/v1/work-days?month=2026-11`);
    assert.equal(res.status, 401);
  });

  test('token rác trả 401', async () => {
    const res = await fetch(`${t.base}/v1/jobs`, { headers: { authorization: 'Bearer abc.def.ghi' } });
    assert.equal(res.status, 401);
    assert.equal((await json(res)).error.code, 'invalid_token');
  });
});

describe('Đọc body', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  let token = '';
  before(async () => {
    t = await startTestServer();
    token = (await t.deps.auth.issue('user-1')).accessToken;
  });
  after(async () => { await t.close(); });

  const put = (body: string, type = 'application/json') =>
    fetch(`${t.base}/v1/work-days/0b7c7f0e-8a43-4f6b-9a3e-2f1d6c5b4a39`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': type },
      body,
    });

  test('sai Content-Type trả 415', async () => {
    assert.equal((await put('{}', 'text/plain')).status, 415);
  });

  test('JSON hỏng trả 400', async () => {
    assert.equal((await put('{hỏng')).status, 400);
  });

  test('body quá lớn trả 413', async () => {
    assert.equal((await put(JSON.stringify({ x: 'a'.repeat(5000) }))).status, 413);
  });

  test('dữ liệu sai trả 422 kèm chi tiết từng trường', async () => {
    const res = await put(JSON.stringify({ jobId: 'j', date: '2026-02-30', hours: {}, allowance: -1 }));
    assert.equal(res.status, 422);
    const body = await json(res);
    assert.equal(body.error.code, 'validation_failed');
    assert.ok(body.error.details.some((d: { path: string }) => d.path === 'date'));
  });
});

// Luồng refresh thành công, xoay vòng và đăng xuất cần MongoDB thật: xem test/integration.test.ts
describe('Xác thực', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => {
    // Người dùng tồn tại nhưng không có phiên nào (giống token cấp trước khi có collection sessions)
    const cols = {
      users: { findOne: async (f: { _id: string }) => ({ _id: f._id, role: 'user' }) },
      sessions: { findOneAndUpdate: async () => null, findOne: async () => null },
    } as unknown as Collections;
    t = await startTestServer({ cols });
  });
  after(async () => { await t.close(); });

  const refresh = (refreshToken: string) =>
    fetch(`${t.base}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

  test('refresh token hợp lệ về chữ ký nhưng không có phiên thì bị từ chối', async () => {
    const { refreshToken } = await t.deps.auth.issue('user-1');
    const res = await refresh(refreshToken);
    assert.equal(res.status, 401);
    assert.equal((await json(res)).error.code, 'invalid_token');
  });

  test('không dùng được access token để refresh', async () => {
    const { accessToken } = await t.deps.auth.issue('user-1');
    assert.equal((await refresh(accessToken)).status, 401);
  });

  test('giới hạn số lần gọi đăng nhập', async () => {
    // Giới hạn trong test là 3 lần/phút, hai test trên đã dùng 2 lần
    const res1 = await refresh('xxxxxxxxxxxx');
    const res2 = await refresh('xxxxxxxxxxxx');
    assert.equal(res1.status, 401);
    assert.equal(res2.status, 429);
  });
});

describe('CORS cho bản web', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => {
    t = await startTestServer({ config: { ...config, corsOrigins: ['http://localhost:8081'] } });
  });
  after(async () => { await t.close(); });

  test('preflight từ origin được phép trả 204 kèm header CORS', async () => {
    const res = await fetch(`${t.base}/v1/sync`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    assert.match(res.headers.get('access-control-allow-methods') ?? '', /POST/);
    assert.match(res.headers.get('access-control-allow-headers') ?? '', /authorization/);
  });

  test('phản hồi thường và phản hồi lỗi đều có header CORS', async () => {
    const ok = await fetch(`${t.base}/health`, { headers: { origin: 'http://localhost:8081' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    assert.equal(ok.headers.get('access-control-expose-headers'), 'x-request-id');
    const err = await fetch(`${t.base}/v1/jobs`, { headers: { origin: 'http://localhost:8081' } });
    assert.equal(err.status, 401);
    assert.equal(err.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  });

  test('origin không được phép: không có header CORS, OPTIONS vẫn là 405', async () => {
    const res = await fetch(`${t.base}/v1/sync`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('mặc định (CORS_ORIGINS trống) không bật CORS', async () => {
    const plain = await startTestServer();
    try {
      const res = await fetch(`${plain.base}/health`, { headers: { origin: 'http://localhost:8081' } });
      assert.equal(res.headers.get('access-control-allow-origin'), null);
    } finally {
      await plain.close();
    }
  });
});
