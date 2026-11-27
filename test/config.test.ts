import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { NOTE_MAX, SYNC_BATCH_MAX, SyncRequest } from '../src/schemas/index.ts';
import { config, startTestServer } from './helpers.ts';

const BASE_ENV = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://unused',
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
};

describe('NODE_ENV', () => {
  test('thiếu NODE_ENV thì không khởi động (không ngầm coi là development)', () => {
    const { NODE_ENV: _, ...env } = BASE_ENV;
    assert.throws(() => loadConfig(env), /NODE_ENV bắt buộc/);
  });

  test('giá trị lạ cũng bị từ chối', () => {
    assert.throws(() => loadConfig({ ...BASE_ENV, NODE_ENV: 'prod' }), /NODE_ENV bắt buộc/);
  });
});

describe('TRUST_PROXY', () => {
  const hops = (v?: string) => loadConfig({ ...BASE_ENV, ...(v === undefined ? {} : { TRUST_PROXY: v }) }).trustProxyHops;

  test('false, trống hoặc không đặt là 0; true là 1; số là số proxy', () => {
    assert.equal(hops(), 0);
    assert.equal(hops(''), 0);
    assert.equal(hops('false'), 0);
    assert.equal(hops('true'), 1);
    assert.equal(hops('2'), 2);
  });

  test('giá trị sai bị từ chối', () => {
    assert.throws(() => hops('yes'), /TRUST_PROXY/);
    assert.throws(() => hops('11'), /TRUST_PROXY/);
  });
});

describe('Lấy IP người dùng', () => {
  const req = (xff?: string | string[]) => ({
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
    socket: { remoteAddress: '10.0.0.1' },
  }) as Parameters<typeof clientIp>[0];

  test('không tin proxy thì bỏ qua X-Forwarded-For', () => {
    assert.equal(clientIp(req('1.1.1.1'), 0), '10.0.0.1');
  });

  test('sau 1 proxy: lấy phần tử cuối, không lấy phần tử client tự ghi ở đầu', () => {
    // Client gửi "6.6.6.6" giả, proxy nối IP thật 9.9.9.9 vào cuối
    assert.equal(clientIp(req('6.6.6.6, 9.9.9.9'), 1), '9.9.9.9');
  });

  test('sau 2 proxy: lấy phần tử thứ hai từ cuối', () => {
    assert.equal(clientIp(req('6.6.6.6, 9.9.9.9, 172.16.0.5'), 2), '9.9.9.9');
  });

  test('ít phần tử hơn số proxy thì lấy phần tử đầu; không có header thì lấy IP kết nối', () => {
    assert.equal(clientIp(req('9.9.9.9'), 2), '9.9.9.9');
    assert.equal(clientIp(req(), 1), '10.0.0.1');
  });

  test('nhiều header X-Forwarded-For được nối lại theo thứ tự', () => {
    assert.equal(clientIp(req(['6.6.6.6', '9.9.9.9']), 1), '9.9.9.9');
  });
});

describe('Giới hạn đăng nhập sau proxy', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => { t = await startTestServer({ config: { ...config, trustProxyHops: 1 } }); });
  after(async () => { await t.close(); });

  test('đổi phần X-Forwarded-For do client ghi không vượt được giới hạn', async () => {
    // Giới hạn trong test là 3 lần/phút; IP thật (do proxy nối vào cuối) luôn là 9.9.9.9
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${t.base}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `6.6.6.${i}, 9.9.9.9` },
        body: JSON.stringify({ refreshToken: 'xxxxxxxxxxxx' }),
      });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 429]);
  });
});

describe('Giới hạn kích thước body', () => {
  test('mặc định đủ cho gói /v1/sync lớn nhất mà app có thể gửi', () => {
    const limit = loadConfig(BASE_ENV).bodyLimitBytes;
    const at = '2026-11-27T10:00:00.000Z'; // app gửi bằng toISOString
    const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const longJobId = 'j'.repeat(64);
    // Mỗi loại đủ SYNC_BATCH_MAX bản (giới hạn của SyncRequest, cũng là BATCH của app), mọi trường ở độ dài lớn nhất.
    // "ữ" là ký tự tốn nhiều byte nhất trên mỗi đơn vị độ dài chuỗi (3 byte UTF-8)
    const body = {
      since: at,
      jobs: Array.from({ length: SYNC_BATCH_MAX }, (_, i) => ({
        id: uuid(i),
        data: { name: 'ữ'.repeat(60), hourlyWage: 1_000_000, companySize: '5plus', updatedAt: at },
        deletedAt: at,
      })),
      workDays: Array.from({ length: SYNC_BATCH_MAX }, (_, i) => ({
        id: uuid(i),
        data: {
          jobId: longJobId,
          date: '2026-11-27',
          hours: { x1: 20.5, x1_5: 0.5, x2: 0.5, x2_5: 0.5, x3: 0.5 },
          allowance: 100_000_000,
          wageSnapshot: 1_000_000,
          note: 'ữ'.repeat(NOTE_MAX),
          updatedAt: at,
        },
        deletedAt: at,
      })),
      weeklyHolidayPays: Array.from({ length: SYNC_BATCH_MAX }, (_, i) => ({
        id: uuid(i),
        data: { jobId: longJobId, weekStart: '2026-11-23', amount: 100_000_000, updatedAt: at },
        deletedAt: at,
      })),
      firstOpenAt: at,
      settings: { deductRate: 99.9, updatedAt: at },
    };
    assert.ok(SyncRequest.safeParse(body).success, 'gói thử phải hợp lệ theo SyncRequest');
    const size = Buffer.byteLength(JSON.stringify(body));
    assert.ok(size <= limit, `gói lớn nhất ${size} byte vượt BODY_LIMIT_BYTES mặc định ${limit} byte`);
  });
});
