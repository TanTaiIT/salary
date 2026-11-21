// Test các route config, admin, xóa tài khoản và sync có jobs, với collection giả trong bộ nhớ.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Collections } from '../src/db/client.ts';
import { json, startTestServer } from './helpers.ts';

type Doc = Record<string, any>;

/** Collection giả, đủ cho các phép mà route dùng; filter chỉ so khớp bằng nhau và vài toán tử đơn giản. */
function fakeCollection(seed: Doc[] = []) {
  const docs = [...seed];
  const matches = (d: Doc, f: Doc) =>
    Object.entries(f).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('$gt' in v && !(d[k] > v.$gt)) return false;
        if ('$lte' in v && !(d[k] <= v.$lte)) return false;
        return true;
      }
      return v === null ? d[k] == null : d[k] === v;
    });
  const cursor = (list: Doc[]) => {
    let out = [...list];
    const c = {
      sort(s: Doc) {
        const [[k, dir]] = Object.entries(s) as [[string, number]];
        out.sort((a, b) => (a[k] < b[k] ? -dir : a[k] > b[k] ? dir : 0));
        return c;
      },
      limit(n: number) { out = out.slice(0, n); return c; },
      async toArray() { return out; },
    };
    return c;
  };
  return {
    docs,
    find: (f: Doc = {}) => cursor(docs.filter((d) => matches(d, f))),
    findOne: async (f: Doc) => docs.find((d) => matches(d, f)) ?? null,
    insertOne: async (d: Doc) => { docs.push(d); return { acknowledged: true }; },
    replaceOne: async (f: Doc, d: Doc) => {
      const i = docs.findIndex((x) => matches(x, f));
      if (i >= 0) docs[i] = d; else docs.push(d);
      return { acknowledged: true };
    },
    updateOne: async (f: Doc, u: Doc) => {
      const d = docs.find((x) => matches(x, f));
      if (d && u.$min) for (const [k, v] of Object.entries(u.$min as Doc)) if (d[k] == null || v < d[k]) d[k] = v;
      return { matchedCount: d ? 1 : 0 };
    },
    deleteMany: async (f: Doc) => {
      for (let i = docs.length - 1; i >= 0; i--) if (matches(docs[i]!, f)) docs.splice(i, 1);
      return { acknowledged: true };
    },
    deleteOne: async (f: Doc) => {
      const i = docs.findIndex((x) => matches(x, f));
      if (i >= 0) docs.splice(i, 1);
      return { acknowledged: true };
    },
  };
}

function fakeCols(seed: Partial<Record<keyof Collections, Doc[]>> = {}) {
  const names = ['users', 'jobs', 'workDays', 'weeklyHolidayPays', 'ruleSets', 'appConfig', 'auditLogs', 'sessions'] as const;
  return Object.fromEntries(names.map((n) => [n, fakeCollection(seed[n])])) as unknown as Record<
    (typeof names)[number],
    ReturnType<typeof fakeCollection>
  >;
}

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const DAY_ID = '22222222-2222-4222-8222-222222222222';
const created = new Date('2026-01-01T00:00:00Z');

describe('Route mới', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  let cols: ReturnType<typeof fakeCols>;
  let userToken = '';
  let adminToken = '';

  before(async () => {
    cols = fakeCols({
      users: [
        { _id: 'user-1', name: 'A', provider: 'dev', providerId: 'A', role: 'user', createdAt: created, firstSeenAt: new Date('2026-05-01T00:00:00Z') },
        { _id: 'admin-1', name: 'B', provider: 'dev', providerId: 'B', role: 'admin', createdAt: created },
      ],
      ruleSets: [
        { _id: '2026', year: 2026, minimumWage: 10320, holidays: [], weeklyHoliday: { minHours: 15, maxHours: 40, paidHours: 8 }, updatedAt: created, updatedBy: 'admin-1' },
      ],
    });
    t = await startTestServer({ cols: cols as unknown as Collections });
    userToken = (await t.deps.auth.issue('user-1')).accessToken;
    adminToken = (await t.deps.auth.issue('admin-1')).accessToken;
  });
  after(async () => { await t.close(); });

  const call = (method: string, path: string, token?: string, body?: unknown) =>
    fetch(`${t.base}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  test('GET /v1/config không cần đăng nhập, trả cấu hình mặc định khi chưa có bản ghi', async () => {
    const res = await call('GET', '/v1/config');
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.ads.enabled, true);
    assert.equal(body.ads.tiers.length, 3);
    assert.equal(body.minAppVersion, '0.0.0');
  });

  test('GET /v1/rules/:year không để lộ updatedBy', async () => {
    const body = await json(await call('GET', '/v1/rules/2026'));
    assert.equal(body.minimumWage, 10320);
    assert.equal('updatedBy' in body, false);
  });

  test('route admin: thiếu token 401, người dùng thường 403', async () => {
    assert.equal((await call('GET', '/v1/admin/rules')).status, 401);
    const res = await call('GET', '/v1/admin/rules', userToken);
    assert.equal(res.status, 403);
    assert.equal((await json(res)).error.code, 'forbidden');
  });

  test('admin sửa quy định thì ghi auditLogs với giá trị cũ và mới', async () => {
    const res = await call('PUT', '/v1/admin/rules/2026', adminToken, {
      minimumWage: 10500,
      holidays: [{ date: '2026-12-25', name: 'Giáng sinh' }, { date: '2026-01-01', name: 'Năm mới' }],
      weeklyHoliday: { minHours: 15, maxHours: 40, paidHours: 8 },
    });
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal(body.minimumWage, 10500);
    assert.equal(body.holidays[0].date, '2026-01-01');

    const logs = await json(await call('GET', '/v1/admin/audit-logs?target=ruleSets/2026', adminToken));
    assert.equal(logs.items.length, 1);
    assert.equal(logs.items[0].action, 'rules.update');
    assert.equal(logs.items[0].actorId, 'admin-1');
    assert.equal(logs.items[0].before.minimumWage, 10320);
    assert.equal(logs.items[0].after.minimumWage, 10500);
  });

  test('admin: ngày lễ khác năm trả 422', async () => {
    const res = await call('PUT', '/v1/admin/rules/2027', adminToken, {
      minimumWage: 10500,
      holidays: [{ date: '2026-12-25', name: 'Giáng sinh' }],
      weeklyHoliday: { minHours: 15, maxHours: 40, paidHours: 8 },
    });
    assert.equal(res.status, 422);
  });

  test('sync: nơi làm việc mới tạo dùng được cho ngày công trong cùng gói, firstOpenAt lấy giá trị sớm nhất', async () => {
    const res = await call('POST', '/v1/sync', userToken, {
      since: null,
      firstOpenAt: '2026-03-01T00:00:00.000Z',
      jobs: [
        { id: JOB_ID, data: { name: 'Nhà máy A', hourlyWage: 10320, companySize: '5plus', updatedAt: '2026-11-01T00:00:00.000Z' }, deletedAt: null },
      ],
      workDays: [
        {
          id: DAY_ID,
          data: { jobId: JOB_ID, date: '2026-11-02', hours: { x1: 8, x1_5: 0, x2: 0, x2_5: 0, x3: 0 }, allowance: 0, wageSnapshot: 10320, updatedAt: '2026-11-02T00:00:00.000Z' },
          deletedAt: null,
        },
      ],
    });
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.deepEqual(body.jobResults, [{ id: JOB_ID, status: 'applied' }]);
    assert.deepEqual(body.results, [{ id: DAY_ID, status: 'applied' }]);
    assert.equal(body.jobs.length, 1);
    assert.equal(body.jobs[0].deletedAt, null);
    assert.equal(body.workDays.length, 1);
    assert.equal(body.firstOpenAt, '2026-03-01T00:00:00.000Z');
    assert.equal(body.hasMore, false);
  });

  test('sync: bản nơi làm việc cũ hơn bị bỏ qua (stale)', async () => {
    const body = await json(
      await call('POST', '/v1/sync', userToken, {
        since: null,
        firstOpenAt: '2026-09-01T00:00:00.000Z',
        jobs: [
          { id: JOB_ID, data: { name: 'Tên cũ', hourlyWage: 9000, companySize: 'under5', updatedAt: '2026-10-01T00:00:00.000Z' }, deletedAt: null },
        ],
        workDays: [],
      }),
    );
    assert.deepEqual(body.jobResults, [{ id: JOB_ID, status: 'stale' }]);
    assert.equal(cols.jobs.docs[0]!.name, 'Nhà máy A');
    assert.equal(body.firstOpenAt, '2026-03-01T00:00:00.000Z');
  });

  test('sync vẫn nhận gói cũ không có jobs', async () => {
    const res = await call('POST', '/v1/sync', userToken, { since: null, workDays: [] });
    assert.equal(res.status, 200);
  });

  test('DELETE /v1/me xóa tài khoản và toàn bộ dữ liệu, không đụng người khác', async () => {
    const res = await call('DELETE', '/v1/me', userToken);
    assert.equal(res.status, 204);
    assert.equal(cols.users.docs.some((u) => u._id === 'user-1'), false);
    assert.equal(cols.jobs.docs.length, 0);
    assert.equal(cols.workDays.docs.length, 0);
    assert.equal(cols.users.docs.some((u) => u._id === 'admin-1'), true);
  });

  test('sau khi xóa tài khoản, access token còn hạn bị từ chối và không ghi được dữ liệu', async () => {
    const res = await call('POST', '/v1/jobs', userToken, { name: 'Nhà máy B', hourlyWage: 10320, companySize: '5plus' });
    assert.equal(res.status, 401);
    assert.equal((await json(res)).error.code, 'invalid_token');
    assert.equal(cols.jobs.docs.length, 0);
  });

  test('sau khi xóa tài khoản, refresh token cũ không đổi được token mới', async () => {
    const { refreshToken } = await t.deps.auth.issue('user-1');
    const res = await call('POST', '/v1/auth/refresh', undefined, { refreshToken });
    assert.equal(res.status, 401);
    assert.equal((await json(res)).error.code, 'invalid_token');
  });
});

describe('nextCursor', async () => {
  const { nextCursor } = await import('../src/routes/sync.ts');
  const at = (ms: number) => ({ serverUpdatedAt: new Date(ms) });
  const since = new Date(0);

  test('hết dữ liệu: mốc là serverTime lùi 5 giây', () => {
    const r = nextCursor(since, new Date(100_000), [[at(1)], []], 3);
    assert.deepEqual(r, { cursor: new Date(95_000), hasMore: false });
  });

  test('còn dữ liệu: mốc lùi 1ms trước bản cuối để không cắt ngang nhóm trùng thời điểm', () => {
    const r = nextCursor(since, new Date(100_000), [[at(10), at(20), at(20)], [at(5)]], 3);
    assert.deepEqual(r, { cursor: new Date(19), hasMore: true });
  });

  test('cả trang trùng một thời điểm thì dùng đúng thời điểm đó để không lặp mãi', () => {
    const r = nextCursor(new Date(10), new Date(100_000), [[at(20), at(20), at(20)], []], 3);
    assert.deepEqual(r, { cursor: new Date(20), hasMore: true });
  });
});

describe('Xóa ngày công của nơi làm đã xóa mềm', () => {
  test('thay đổi xóa được chấp nhận, tạo mới thì bị từ chối unknown_job', async () => {
    const { applyWorkDayChange } = await import('../src/services/workDays.ts');
    const cols = fakeCols() as unknown as Collections;
    const ids = { active: new Set<string>(), owned: new Set([JOB_ID]) };
    const data = { jobId: JOB_ID, date: '2026-11-02', hours: { x1: 8, x1_5: 0, x2: 0, x2_5: 0, x3: 0 }, allowance: 0, wageSnapshot: 10320, updatedAt: '2026-11-02T00:00:00.000Z' };
    const del = await applyWorkDayChange(cols, 'user-1', { id: DAY_ID, data, deletedAt: '2026-11-03T00:00:00.000Z' }, ids);
    assert.equal(del.status, 'applied');
    await assert.rejects(
      applyWorkDayChange(cols, 'user-1', { id: '33333333-3333-4333-8333-333333333333', data, deletedAt: null }, ids),
      (e: any) => e.code === 'unknown_job',
    );
  });
});
