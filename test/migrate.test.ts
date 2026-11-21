// Test script chuyển đổi dữ liệu với MongoDB thật; không kết nối được thì tự bỏ qua.
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../scripts/migrate.ts';
import { openTestDb, SKIP_REASON } from './db.ts';

const testDb = await openTestDb();

describe('pnpm migrate', { skip: testDb ? false : SKIP_REASON }, () => {
  after(async () => { await testDb?.close(); });

  test('bổ sung trường còn thiếu, giữ nguyên trường đã có, chạy lại không đổi gì', async () => {
    const { cols } = testDb!;
    const old = new Date('2026-01-01T00:00:00Z');
    const kept = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-11-21T00:00:00Z');

    // Bản ghi kiểu cũ: thiếu serverUpdatedAt, deletedAt, role, firstSeenAt
    await cols.jobs.insertMany([
      { _id: 'job-old', userId: 'u1', name: 'A', hourlyWage: 10320, companySize: '5plus', createdAt: old, updatedAt: old } as any,
      { _id: 'job-new', userId: 'u1', name: 'B', hourlyWage: 10320, companySize: '5plus', createdAt: old, updatedAt: old, deletedAt: null, serverUpdatedAt: kept },
    ]);
    await cols.users.insertMany([
      { _id: 'u1', name: 'A', provider: 'dev', providerId: 'A', createdAt: old },
      { _id: 'u2', name: 'B', provider: 'dev', providerId: 'B', role: 'admin', firstSeenAt: kept, createdAt: old },
    ]);

    const r = await migrate(cols, now);
    assert.equal(r.serverUpdatedAt.jobs, 1);
    assert.equal(r.deletedAt.jobs, 1);
    assert.equal(r.userRole, 1);
    assert.equal(r.userFirstSeenAt, 1);

    const jobOld = await cols.jobs.findOne({ _id: 'job-old' });
    assert.deepEqual(jobOld?.serverUpdatedAt, now);
    assert.equal(jobOld?.deletedAt, null);
    assert.deepEqual((await cols.jobs.findOne({ _id: 'job-new' }))?.serverUpdatedAt, kept);

    const u1 = await cols.users.findOne({ _id: 'u1' });
    assert.equal(u1?.role, 'user');
    assert.deepEqual(u1?.firstSeenAt, old);
    const u2 = await cols.users.findOne({ _id: 'u2' });
    assert.equal(u2?.role, 'admin');
    assert.deepEqual(u2?.firstSeenAt, kept);

    const again = await migrate(cols, new Date());
    assert.deepEqual(again, {
      serverUpdatedAt: { jobs: 0, workDays: 0, weeklyHolidayPays: 0 },
      deletedAt: { jobs: 0, workDays: 0, weeklyHolidayPays: 0 },
      userRole: 0,
      userFirstSeenAt: 0,
    });
  });
});
