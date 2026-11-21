import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayPay, emptyHours, monthSummary, weeklyHolidayPay } from '../../src/payroll/index.ts';

const WAGE = 10_320;

test('8 giờ cơ bản', () => {
  const r = dayPay({ date: '2026-11-14', hours: { ...emptyHours(), x1: 8 }, allowance: 0, wage: WAGE });
  assert.equal(r.work, 82_560);
});

test('giờ lẻ và nhiều hệ số, cộng trợ cấp', () => {
  const r = dayPay({
    date: '2026-11-14',
    hours: { x1: 7.5, x1_5: 1.5, x2: 0, x2_5: 0.5, x3: 0 },
    allowance: 50_000,
    wage: WAGE,
  });
  // 7,5×1 + 1,5×1,5 + 0,5×2,5 = 11 giờ quy đổi
  assert.equal(r.work, 11 * WAGE);
  assert.equal(r.total, 11 * WAGE + 50_000);
});

test('bỏ phần lẻ dưới 1 won', () => {
  const r = dayPay({ date: '2026-11-14', hours: { ...emptyHours(), x1_5: 0.5 }, allowance: 0, wage: 10_321 });
  assert.equal(r.work, Math.floor(0.75 * 10_321));
});

test('주휴수당: dưới 15 giờ thì không có', () => {
  assert.equal(weeklyHolidayPay(14.5, WAGE), 0);
});

test('주휴수당: 15 giờ và 40 giờ', () => {
  assert.equal(weeklyHolidayPay(15, WAGE), 30_960);
  assert.equal(weeklyHolidayPay(40, WAGE), 82_560);
});

test('주휴수당: quá 40 giờ vẫn chỉ trả 8 giờ', () => {
  assert.equal(weeklyHolidayPay(52, WAGE), 82_560);
});

test('tổng hợp tháng', () => {
  const s = monthSummary(
    [
      { date: '2026-11-09', hours: { ...emptyHours(), x1: 8 }, allowance: 0, wage: WAGE },
      { date: '2026-11-10', hours: { ...emptyHours(), x1: 6, x1_5: 2 }, allowance: 10_000, wage: WAGE },
      { date: '2026-11-11', hours: emptyHours(), allowance: 5_000, wage: WAGE },
    ],
    [{ weekStart: '2026-11-09', amount: 30_960 }],
  );
  assert.equal(s.baseHours, 14);
  assert.equal(s.overtimeHours, 2);
  assert.equal(s.workDays, 2);
  assert.equal(s.workPay, 17 * WAGE);
  assert.equal(s.total, 17 * WAGE + 15_000 + 30_960);
});
