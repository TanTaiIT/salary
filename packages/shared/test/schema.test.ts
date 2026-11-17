import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkDayInput } from '../src/index.ts';

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
