import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { json, startTestServer } from './helpers.ts';

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

describe('Xác thực', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => { t = await startTestServer(); });
  after(async () => { await t.close(); });

  const refresh = (refreshToken: string) =>
    fetch(`${t.base}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

  test('đổi refresh token lấy cặp token mới', async () => {
    const { refreshToken } = await t.deps.auth.issue('user-1');
    const res = await refresh(refreshToken);
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(await t.deps.auth.verify(body.accessToken, 'access'), 'user-1');
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
