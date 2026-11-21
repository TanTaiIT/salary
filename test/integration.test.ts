// Test tích hợp với MongoDB thật: index unique một phần, lỗi trùng khóa, upsert, $min, phân trang.
// Cần `docker compose up -d`; không kết nối được thì cả file tự bỏ qua.
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkDayDoc } from '../src/db/client.ts';
import { RateLimiter } from '../src/lib/rateLimit.ts';
import { openTestDb, SKIP_REASON, type TestDb } from './db.ts';
import { createFakeIdp } from './fakeIdp.ts';
import { json, startTestServer } from './helpers.ts';

const testDb = await openTestDb();
const idp = await createFakeIdp();
const skip = testDb ? false : SKIP_REASON;

const hours8 = { x1: 8, x1_5: 0, x2: 0, x2_5: 0, x3: 0 };
const iso = (s: string) => new Date(s).toISOString();

describe('Tích hợp MongoDB', { skip }, () => {
  let db: TestDb;
  let t: Awaited<ReturnType<typeof startTestServer>>;
  // Giới hạn đăng nhập cao: các test phiên gọi refresh/logout nhiều lần
  const limiters = {
    global: new RateLimiter(10_000, 60_000),
    auth: new RateLimiter(10_000, 60_000),
    admin: new RateLimiter(10_000, 60_000),
  };

  before(async () => {
    db = testDb!;
    t = await startTestServer({ cols: db.cols, withTransaction: db.withTransaction, limiters, idTokens: idp.verifier });
  });
  after(async () => {
    await t?.close();
    for (const l of Object.values(limiters)) l.close();
    await db?.close();
  });

  /** Tạo người dùng thẳng trong database rồi cấp token, không đi qua route đăng nhập. */
  async function newUser(extra: Record<string, unknown> = {}) {
    const id = randomUUID();
    await db.cols.users.insertOne({ _id: id, name: 'Test', provider: 'dev', providerId: id, role: 'user', createdAt: new Date(), ...extra });
    const { accessToken } = await t.deps.auth.issue(id);
    return { id, token: accessToken };
  }

  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(`${t.base}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: res.status === 204 ? null : await json(res) };
  };

  const sync = (token: string, body: Record<string, unknown>) =>
    call('POST', '/v1/sync', token, { since: null, workDays: [], ...body });

  const jobChange = (id: string, updatedAt: string, deletedAt: string | null = null) => ({
    id,
    data: { name: 'Nhà máy A', hourlyWage: 10_320, companySize: '5plus', updatedAt },
    deletedAt,
  });

  const dayChange = (id: string, jobId: string, date: string, updatedAt: string, deletedAt: string | null = null) => ({
    id,
    data: { jobId, date, hours: hours8, allowance: 0, wageSnapshot: 10_320, updatedAt },
    deletedAt,
  });

  const weeklyChange = (id: string, jobId: string, updatedAt: string, deletedAt: string | null = null, amount = 30_960) => ({
    id,
    data: { jobId, weekStart: '2026-11-16', amount, updatedAt },
    deletedAt,
  });

  describe('Nơi làm việc', () => {
    test('người dùng mới chưa có nơi làm nào', async () => {
      const u = await newUser();
      const res = await call('GET', '/v1/jobs', u.token);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.items, []);
    });

    test('POST /v1/jobs: app tự tạo id, id trùng trả 409 job_exists, không gửi id thì server tạo', async () => {
      const u = await newUser();
      const id = randomUUID();
      const input = { name: 'Nhà máy A', hourlyWage: 10_320, companySize: '5plus' };

      const first = await call('POST', '/v1/jobs', u.token, { ...input, id });
      assert.equal(first.status, 201);
      assert.equal(first.body.id, id);

      const dup = await call('POST', '/v1/jobs', u.token, { ...input, id });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.error.code, 'job_exists');

      const other = await newUser();
      assert.equal((await call('POST', '/v1/jobs', other.token, { ...input, id })).status, 409);

      const auto = await call('POST', '/v1/jobs', u.token, input);
      assert.equal(auto.status, 201);
      assert.match(auto.body.id, /^[0-9a-f-]{36}$/);
      assert.notEqual(auto.body.id, id);
    });
  });

  describe('Đăng nhập dev', () => {
    test('người dùng mới có role user và firstSeenAt, bỏ qua role client gửi', async () => {
      const name = `dev-${randomUUID().slice(0, 8)}`;
      const res = await call('POST', '/v1/auth/dev-login', undefined, { name, role: 'admin' });
      assert.equal(res.status, 200);
      const user = await db.cols.users.findOne({ _id: res.body.user.id });
      assert.equal(user?.role, 'user');
      assert.ok(user?.firstSeenAt instanceof Date);
    });
  });

  describe('Phiên đăng nhập', () => {
    const devLogin = async (name: string) => (await call('POST', '/v1/auth/dev-login', undefined, { name })).body;
    const refresh = (refreshToken: string) => call('POST', '/v1/auth/refresh', undefined, { refreshToken });
    const logout = (body: unknown) => call('POST', '/v1/auth/logout', undefined, body);
    const uniqueName = () => `dev-${randomUUID().slice(0, 8)}`;

    test('collection sessions có index TTL và index theo người dùng', async () => {
      const names = (await db.cols.sessions.indexes()).map((i) => i.name);
      assert.ok(names.includes('ttl_expires'));
      assert.ok(names.includes('user_sessions'));
    });

    test('xoay vòng: refresh liên tiếp đều được, token cũ bị từ chối', async () => {
      const a = (await devLogin(uniqueName())).refreshToken;
      const r1 = await refresh(a);
      assert.equal(r1.status, 200);
      const r2 = await refresh(r1.body.refreshToken);
      assert.equal(r2.status, 200);
      assert.equal(Object.keys(r2.body).sort().join(), 'accessToken,expiresIn,refreshToken');
      assert.equal((await refresh(a)).status, 401);
    });

    test('dùng lại token đã xoay vòng thì thu hồi mọi phiên, kể cả token mới', async () => {
      const login = await devLogin(uniqueName());
      const b = (await refresh(login.refreshToken)).body.refreshToken;
      const reuse = await refresh(login.refreshToken);
      assert.equal(reuse.status, 401);
      assert.equal(reuse.body.error.code, 'invalid_token');
      assert.equal((await refresh(b)).status, 401);
      assert.equal(await db.cols.sessions.countDocuments({ userId: login.user.id }), 0);
    });

    test('refresh token không có phiên thì bị từ chối', async () => {
      const u = await newUser();
      const { refreshToken } = await t.deps.auth.issue(u.id);
      const res = await refresh(refreshToken);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'invalid_token');
    });

    test('đăng xuất máy A không ảnh hưởng máy B; token hỏng vẫn 204; thiếu token là 422', async () => {
      const name = uniqueName();
      const onA = (await devLogin(name)).refreshToken;
      const onB = (await devLogin(name)).refreshToken;
      assert.equal((await logout({ refreshToken: onA })).status, 204);
      assert.equal((await refresh(onA)).status, 401);
      assert.equal((await refresh(onB)).status, 200);

      assert.equal((await logout({ refreshToken: 'xxxxxxxxxxxx' })).status, 204);
      assert.equal((await logout({ refreshToken: onA })).status, 204);
      const missing = await logout({});
      assert.equal(missing.status, 422);
      assert.equal(missing.body.error.code, 'validation_failed');
    });

    test('xóa tài khoản xóa luôn các phiên, refresh token cũ bị từ chối', async () => {
      const login = await devLogin(uniqueName());
      assert.equal((await call('DELETE', '/v1/me', login.accessToken)).status, 204);
      assert.equal(await db.cols.sessions.countDocuments({ userId: login.user.id }), 0);
      assert.equal((await refresh(login.refreshToken)).status, 401);
    });

    test('xóa tài khoản lỗi giữa chừng thì transaction hoàn tác, không còn dữ liệu sót một nửa', async () => {
      const u = await newUser();
      const now = new Date();
      await db.cols.jobs.insertOne({
        _id: randomUUID(), userId: u.id, name: 'A', hourlyWage: 10320, companySize: '5plus',
        createdAt: now, updatedAt: now, deletedAt: null, serverUpdatedAt: now,
      });
      await assert.rejects(
        db.withTransaction(async (session) => {
          await db.cols.jobs.deleteMany({ userId: u.id }, { session });
          throw new Error('lỗi giả giữa chừng');
        }),
        /lỗi giả giữa chừng/,
      );
      assert.equal(await db.cols.jobs.countDocuments({ userId: u.id }), 1);
      assert.equal(await db.cols.users.countDocuments({ _id: u.id }), 1);
    });

    test('xóa tài khoản qua transaction thật xóa hết dữ liệu', async () => {
      const u = await newUser();
      const now = new Date();
      await db.cols.jobs.insertOne({
        _id: randomUUID(), userId: u.id, name: 'A', hourlyWage: 10320, companySize: '5plus',
        createdAt: now, updatedAt: now, deletedAt: null, serverUpdatedAt: now,
      });
      assert.equal((await call('DELETE', '/v1/me', u.token)).status, 204);
      assert.equal(await db.cols.jobs.countDocuments({ userId: u.id }), 0);
      assert.equal(await db.cols.users.countDocuments({ _id: u.id }), 0);
    });
  });

  describe('Đăng nhập Apple, Google', () => {
    const login = (provider: string, body: unknown) => call('POST', `/v1/auth/${provider}`, undefined, body);

    test('Google lần đầu tạo người dùng, lần sau trả cùng id; token dùng được và refresh được', async () => {
      const sub = `g-${randomUUID()}`;
      const first = await login('google', { idToken: await idp.sign('google', { sub, name: 'Lan', email: 'lan@example.com' }) });
      assert.equal(first.status, 200);
      assert.equal(first.body.user.name, 'Lan');

      const again = await login('google', { idToken: await idp.sign('google', { sub, name: 'Tên khác' }) });
      assert.equal(again.body.user.id, first.body.user.id);
      assert.equal(again.body.user.name, 'Lan');
      assert.equal(await db.cols.users.countDocuments({ provider: 'google', providerId: sub }), 1);

      assert.equal((await call('GET', '/v1/jobs', first.body.accessToken)).status, 200);
      assert.equal((await call('POST', '/v1/auth/refresh', undefined, { refreshToken: first.body.refreshToken })).status, 200);
    });

    test('người dùng mới có role user, firstSeenAt, không lưu email', async () => {
      const sub = `g-${randomUUID()}`;
      const res = await login('google', { idToken: await idp.sign('google', { sub, email: 'x@example.com' }) });
      const user = await db.cols.users.findOne({ _id: res.body.user.id });
      assert.equal(user?.role, 'user');
      assert.ok(user?.firstSeenAt instanceof Date);
      assert.equal(JSON.stringify(user).includes('example.com'), false);
    });

    test('Apple không có tên thì là "Người dùng"; tên app gửi lên được ưu tiên', async () => {
      const noName = await login('apple', { idToken: await idp.sign('apple', { sub: `a-${randomUUID()}` }) });
      assert.equal(noName.body.user.name, 'Người dùng');
      const withName = await login('apple', { idToken: await idp.sign('apple', { sub: `a-${randomUUID()}` }), name: ' Minh ' });
      assert.equal(withName.body.user.name, 'Minh');
    });

    test('token sai, token Google gửi tới route Apple, thiếu id token', async () => {
      const bad = await login('google', { idToken: 'x'.repeat(40) });
      assert.equal(bad.status, 401);
      assert.equal(bad.body.error.code, 'invalid_id_token');

      const cross = await login('apple', { idToken: await idp.sign('google') });
      assert.equal(cross.status, 401);
      assert.equal(cross.body.error.code, 'invalid_id_token');

      const missing = await login('google', {});
      assert.equal(missing.status, 422);
      assert.equal(missing.body.error.code, 'validation_failed');
    });

    test('nhà cung cấp chưa cấu hình trả 503', async () => {
      const plain = await startTestServer({ cols: db.cols });
      try {
        const res = await fetch(`${plain.base}/v1/auth/apple`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken: await idp.sign('apple') }),
        });
        assert.equal(res.status, 503);
        assert.equal((await json(res)).error.code, 'provider_not_configured');
      } finally {
        await plain.close();
      }
    });
  });

  describe('Đồng bộ 주휴수당', () => {
    test('nơi làm mới và 주휴수당 cùng gói, có trong tổng tháng', async () => {
      const u = await newUser();
      const jobId = randomUUID();
      const weeklyId = randomUUID();
      const res = await sync(u.token, {
        jobs: [jobChange(jobId, iso('2026-11-01'))],
        weeklyHolidayPays: [weeklyChange(weeklyId, jobId, iso('2026-11-22T10:00:00Z'))],
      });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.jobResults, [{ id: jobId, status: 'applied' }]);
      assert.deepEqual(res.body.weeklyHolidayPayResults, [{ id: weeklyId, status: 'applied' }]);
      assert.equal(res.body.weeklyHolidayPays.length, 1);
      assert.equal(res.body.weeklyHolidayPays[0].amount, 30_960);

      const month = await call('GET', '/v1/work-days?month=2026-11', u.token);
      assert.equal(month.body.summary.weeklyHolidayPay, 30_960);
    });

    test('bản cũ hơn là stale, trùng tuần là duplicate_week, xác nhận lại được sau khi xóa', async () => {
      const u = await newUser();
      const jobId = randomUUID();
      const a = randomUUID();
      const b = randomUUID();
      await sync(u.token, { jobs: [jobChange(jobId, iso('2026-11-01'))], weeklyHolidayPays: [weeklyChange(a, jobId, iso('2026-11-22T10:00:00Z'))] });

      const stale = await sync(u.token, { weeklyHolidayPays: [weeklyChange(a, jobId, iso('2026-11-22T09:00:00Z'), null, 1)] });
      assert.deepEqual(stale.body.weeklyHolidayPayResults, [{ id: a, status: 'stale' }]);
      assert.equal((await db.cols.weeklyHolidayPays.findOne({ _id: a }))?.amount, 30_960);

      const dup = await sync(u.token, { weeklyHolidayPays: [weeklyChange(b, jobId, iso('2026-11-22T11:00:00Z'))] });
      assert.deepEqual(dup.body.weeklyHolidayPayResults, [{ id: b, status: 'rejected', code: 'duplicate_week' }]);

      const again = await sync(u.token, {
        weeklyHolidayPays: [
          weeklyChange(a, jobId, iso('2026-11-22T12:00:00Z'), iso('2026-11-22T12:00:00Z')),
          weeklyChange(b, jobId, iso('2026-11-22T12:01:00Z')),
        ],
      });
      assert.deepEqual(again.body.weeklyHolidayPayResults, [
        { id: a, status: 'applied' },
        { id: b, status: 'applied' },
      ]);
    });

    test('nơi làm không thuộc người dùng thì unknown_job; gói kiểu cũ trả mảng rỗng', async () => {
      const u = await newUser();
      const id = randomUUID();
      const res = await sync(u.token, { weeklyHolidayPays: [weeklyChange(id, randomUUID(), iso('2026-11-22'))] });
      assert.deepEqual(res.body.weeklyHolidayPayResults, [{ id, status: 'rejected', code: 'unknown_job' }]);

      const old = await call('POST', '/v1/sync', u.token, { since: null, workDays: [] });
      assert.equal(old.status, 200);
      assert.deepEqual(old.body.weeklyHolidayPayResults, []);
    });
  });

  describe('Đồng bộ trên MongoDB thật', () => {
    test('firstOpenAt: giữ giá trị sớm nhất, không nhận thời điểm ở tương lai', async () => {
      const reinstall = await newUser({ firstSeenAt: new Date('2026-03-01T00:00:00Z') });
      const r1 = await sync(reinstall.token, { firstOpenAt: iso('2026-09-01') });
      assert.equal(r1.body.firstOpenAt, iso('2026-03-01'));

      const future = await newUser();
      const before = Date.now();
      const r2 = await sync(future.token, { firstOpenAt: iso('2099-01-01') });
      const saved = (await db.cols.users.findOne({ _id: future.id }))?.firstSeenAt;
      assert.ok(saved && saved.getTime() >= before && saved.getTime() <= Date.now());
      assert.equal(r2.body.firstOpenAt, saved.toISOString());
    });

    test('trùng ngày công qua index một phần là duplicate_day; xóa ngày công của nơi làm đã xóa được chấp nhận', async () => {
      const u = await newUser();
      const jobId = randomUUID();
      const d1 = randomUUID();
      const d2 = randomUUID();
      await sync(u.token, { jobs: [jobChange(jobId, iso('2026-11-01'))], workDays: [dayChange(d1, jobId, '2026-11-02', iso('2026-11-02'))] });

      const dup = await sync(u.token, { workDays: [dayChange(d2, jobId, '2026-11-02', iso('2026-11-03'))] });
      assert.deepEqual(dup.body.results, [{ id: d2, status: 'rejected', code: 'duplicate_day' }]);

      // Xóa mềm nơi làm: xóa ngày công của nó vẫn được, tạo mới thì không
      await sync(u.token, { jobs: [jobChange(jobId, iso('2026-11-05'), iso('2026-11-05'))] });
      const res = await sync(u.token, {
        workDays: [
          dayChange(d1, jobId, '2026-11-02', iso('2026-11-06'), iso('2026-11-06')),
          dayChange(d2, jobId, '2026-11-03', iso('2026-11-06')),
        ],
      });
      assert.deepEqual(res.body.results, [
        { id: d1, status: 'applied' },
        { id: d2, status: 'rejected', code: 'unknown_job' },
      ]);
    });

    test('2.300 ngày công, nhóm trùng thời điểm vắt qua giới hạn: gọi lặp theo hasMore nhận đủ', async () => {
      const u = await newUser();
      const jobId = randomUUID();
      const t1 = new Date('2026-01-01T00:00:01Z');
      const t2 = new Date('2026-01-01T00:00:02Z');
      // 1.900 bản ở t1 và 400 bản ở t2: bản thứ 2.000 nằm giữa nhóm t2
      const docs: WorkDayDoc[] = Array.from({ length: 2_300 }, (_, i) => ({
        _id: randomUUID(),
        userId: u.id,
        jobId,
        date: '2026-01-01',
        hours: hours8,
        allowance: 0,
        wageSnapshot: 10_320,
        updatedAt: t1,
        deletedAt: t1, // đã xóa mềm để không đụng index một ngày một bản
        serverUpdatedAt: i < 1_900 ? t1 : t2,
      }));
      await db.cols.workDays.insertMany(docs);

      const seen = new Set<string>();
      let since: string | null = null;
      for (let round = 0; round < 5; round++) {
        const res = await call('POST', '/v1/sync', u.token, { since, workDays: [] });
        for (const d of res.body.workDays) seen.add(d.id);
        since = res.body.serverTime;
        if (!res.body.hasMore) break;
      }
      assert.equal(seen.size, 2_300);
    });
  });
});
