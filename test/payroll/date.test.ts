import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, monthRange, weekStart, addDays, dayOfWeek } from '../../src/payroll/index.ts';

test('kiểm tra ngày hợp lệ', () => {
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2026-13-01'), false);
  assert.equal(isValidDate('2026-1-01'), false);
});

test('đầu tuần là thứ Hai, kể cả khi vắt qua tháng', () => {
  assert.equal(weekStart('2026-11-14'), '2026-11-09'); // T7
  assert.equal(weekStart('2026-11-15'), '2026-11-09'); // CN
  assert.equal(weekStart('2026-11-01'), '2026-10-26'); // CN đầu tháng
});

test('khoảng ngày của tháng', () => {
  assert.deepEqual(monthRange('2026-11'), { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.throws(() => monthRange('2026-13'));
});

test('cộng ngày qua năm mới', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('ngày không hợp lệ thì phép tính ngày báo lỗi', () => {
  assert.throws(() => addDays('2026-02-30', 1), RangeError);
  assert.throws(() => dayOfWeek('2026-11-1'), RangeError);
  assert.throws(() => weekStart('khong-phai-ngay'), RangeError);
});

test('tháng sai dạng hoặc ngoài 01 đến 12 thì báo lỗi', () => {
  assert.throws(() => monthRange('2026-1'), RangeError);
  assert.throws(() => monthRange('2026-00'), RangeError);
});

test('thứ trong tuần', () => {
  assert.equal(dayOfWeek('2026-11-22'), 0); // CN
  assert.equal(dayOfWeek('2026-11-16'), 1); // T2
});
