import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobInput, SyncRequest, UserSettingsInput, WeeklyHolidayPayInput, WorkDayInput } from '../src/schemas/index.ts';

const errorPaths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (r.error?.issues ?? []).map((i) => i.path.join('.'));

const valid = {
  jobId: 'job-1',
  date: '2026-11-14',
  hours: { x1: 8, x1_5: 2, x2: 0, x2_5: 0, x3: 0 },
  allowance: 50_000,
  wageSnapshot: 10_320,
  updatedAt: '2026-11-14T09:00:00.000Z',
};

test('ngày công hợp lệ', () => {
  assert.equal(WorkDayInput.safeParse(valid).success, true);
});

test('từ chối giờ không phải bội số 0,5', () => {
  const r = WorkDayInput.safeParse({ ...valid, hours: { ...valid.hours, x1: 7.3 } });
  assert.equal(r.success, false);
});

test('từ chối tổng quá 24 giờ', () => {
  const r = WorkDayInput.safeParse({ ...valid, hours: { x1: 12, x1_5: 8, x2: 6, x2_5: 0, x3: 0 } });
  assert.equal(r.success, false);
});

test('từ chối ngày không tồn tại', () => {
  assert.equal(WorkDayInput.safeParse({ ...valid, date: '2026-02-30' }).success, false);
});

test('từ chối tiền trợ cấp lẻ', () => {
  assert.equal(WorkDayInput.safeParse({ ...valid, allowance: 100.5 }).success, false);
});

const weekly = { jobId: 'job-1', weekStart: '2026-11-16', amount: 30_960, updatedAt: '2026-11-22T09:00:00.000Z' };

test('주휴수당 hợp lệ khi weekStart là thứ Hai', () => {
  assert.equal(WeeklyHolidayPayInput.safeParse(weekly).success, true);
});

test('từ chối weekStart không phải thứ Hai', () => {
  const r = WeeklyHolidayPayInput.safeParse({ ...weekly, weekStart: '2026-11-22' });
  assert.deepEqual(errorPaths(r), ['weekStart']);
});

test('weekStart không có thật thì báo lỗi, không ném ngoại lệ', () => {
  const r = WeeklyHolidayPayInput.safeParse({ ...weekly, weekStart: '2026-02-30' });
  assert.equal(r.success, false);
  assert.ok(errorPaths(r).includes('weekStart'));
});

test('từ chối 주휴수당 lẻ', () => {
  const r = WeeklyHolidayPayInput.safeParse({ ...weekly, amount: 30960.5 });
  assert.deepEqual(errorPaths(r), ['amount']);
});

test('từ chối tên nơi làm toàn khoảng trắng và quy mô sai', () => {
  const r = JobInput.safeParse({ name: '   ', hourlyWage: 10_320, companySize: 'big' });
  assert.deepEqual(errorPaths(r).sort(), ['companySize', 'name']);
});

test('gói đồng bộ kiểu cũ vẫn hợp lệ, trường mới mặc định rỗng', () => {
  const r = SyncRequest.parse({ since: null, workDays: [] });
  assert.deepEqual(r.jobs, []);
  assert.deepEqual(r.weeklyHolidayPays, []);
});

test('từ chối gói quá 500 khoản 주휴수당', () => {
  const change = { id: '0b7c7f0e-8a43-4f6b-9a3e-2f1d6c5b4a39', data: weekly, deletedAt: null };
  const r = SyncRequest.safeParse({ since: null, workDays: [], weeklyHolidayPays: Array(501).fill(change) });
  assert.deepEqual(errorPaths(r), ['weeklyHolidayPays']);
});

test('cài đặt: tỉ lệ khấu trừ bước 0,1 từ 0 đến 100', () => {
  const at = '2026-11-22T00:00:00.000Z';
  for (const v of [0, 3.3, 9.4, 100]) assert.equal(UserSettingsInput.safeParse({ deductRate: v, updatedAt: at }).success, true, `${v}`);
  for (const v of [3.33, -0.1, 100.1]) {
    assert.deepEqual(errorPaths(UserSettingsInput.safeParse({ deductRate: v, updatedAt: at })), ['deductRate'], `${v}`);
  }
  assert.deepEqual(errorPaths(UserSettingsInput.safeParse({ deductRate: 3.3 })), ['updatedAt']);
});

test('gói đồng bộ nhận settings không bắt buộc', () => {
  assert.equal(SyncRequest.safeParse({ since: null, workDays: [] }).success, true);
  const r = SyncRequest.safeParse({
    since: null,
    workDays: [],
    settings: { deductRate: 3.3, updatedAt: '2026-11-22T00:00:00.000Z' },
  });
  assert.equal(r.success, true);
  assert.deepEqual(
    errorPaths(SyncRequest.safeParse({ since: null, workDays: [], settings: { deductRate: 3.33, updatedAt: '2026-11-22T00:00:00.000Z' } })),
    ['settings.deductRate'],
  );
});
