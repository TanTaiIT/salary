import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  averageDayPay,
  deductionAmount,
  emptyHours,
  monthSummary,
  weeklyTotals,
  type WorkDay,
} from '../../src/payroll/index.ts';

const WAGE = 10_320;
const day = (date: string, h: Partial<WorkDay['hours']>, allowance = 0, wage = WAGE): WorkDay => ({
  date,
  hours: { ...emptyHours(), ...h },
  allowance,
  wage,
});

describe('Tiền theo loại giờ (payByType)', () => {
  test('cộng theo loại giờ cả tháng', () => {
    const s = monthSummary([day('2026-11-10', { x1: 6, x1_5: 2 }, 10_000), day('2026-11-11', { x1: 8 })]);
    assert.equal(s.payByType.x1, 14 * WAGE); // 144.480
    assert.equal(s.payByType.x1_5, 30_960); // 2 × 1,5 × 10.320
    assert.equal(s.payByType.x2, 0);
  });

  test('bỏ phần lẻ một lần cho cả tháng của từng loại', () => {
    // Mỗi ngày 0,5 giờ x1_5 với lương 10.001 ₩ = 7.500,75 ₩; hai ngày = 15.001,5 → 15.001 ₩
    const s = monthSummary([day('2026-11-10', { x1_5: 0.5 }, 0, 10_001), day('2026-11-11', { x1_5: 0.5 }, 0, 10_001)]);
    assert.equal(s.payByType.x1_5, 15_001);
    // workPay bỏ lẻ theo ngày: 7.500 + 7.500
    assert.equal(s.workPay, 15_000);
  });

  test('mỗi ngày dùng lương giờ của chính ngày đó', () => {
    const s = monthSummary([day('2026-11-10', { x1: 8 }, 0, 10_000), day('2026-11-11', { x1: 8 }, 0, 12_000)]);
    assert.equal(s.payByType.x1, 176_000);
  });
});

describe('Lương theo tuần (weeklyTotals)', () => {
  test('tháng 11/2026 chia thành 6 đoạn T2–CN, cắt ở đầu và cuối tháng', () => {
    const weeks = weeklyTotals('2026-11', []);
    assert.deepEqual(
      weeks.map((w) => [w.from, w.to]),
      [
        ['2026-11-01', '2026-11-01'],
        ['2026-11-02', '2026-11-08'],
        ['2026-11-09', '2026-11-15'],
        ['2026-11-16', '2026-11-22'],
        ['2026-11-23', '2026-11-29'],
        ['2026-11-30', '2026-11-30'],
      ],
    );
    assert.ok(weeks.every((w) => w.total === 0));
  });

  test('cộng tiền công, trợ cấp và 주휴수당 vào đúng đoạn; bỏ ngày ngoài tháng', () => {
    const weeks = weeklyTotals(
      '2026-11',
      [
        day('2026-11-16', { x1: 8 }), // 82.560
        day('2026-11-17', { x1: 6, x1_5: 2 }, 10_000), // 61.920 + 30.960 + 10.000 = 102.880
        day('2026-10-31', { x1: 8 }), // ngoài tháng
      ],
      [
        { weekStart: '2026-11-16', amount: 30_960 }, // CN 22/11 nằm trong đoạn 16–22
        { weekStart: '2026-10-26', amount: 41_280 }, // CN 1/11 nằm trong đoạn đầu
        { weekStart: '2026-11-30', amount: 99_999 }, // CN 6/12 ngoài tháng
      ],
    );
    assert.equal(weeks[0]!.total, 41_280);
    assert.equal(weeks[3]!.total, 82_560 + 102_880 + 30_960); // 216.400
    assert.equal(weeks[5]!.total, 0);
  });
});

describe('Trung bình mỗi ngày làm', () => {
  test('không tính 주휴수당, bỏ phần lẻ', () => {
    const s = monthSummary(
      [day('2026-11-16', { x1: 8 }), day('2026-11-17', { x1: 6, x1_5: 2 }, 10_000), day('2026-11-18', { x1: 8 })],
      [{ weekStart: '2026-11-16', amount: 30_960 }],
    );
    // (82.560 + 102.880 + 82.560) / 3 = 89.333,33…
    assert.equal(averageDayPay(s), 89_333);
  });

  test('chưa có ngày làm thì là 0', () => {
    assert.equal(averageDayPay(monthSummary([])), 0);
  });
});

describe('Khấu trừ ước tính', () => {
  test('thuế 3,3% không bị sai số dấu phẩy động', () => {
    assert.equal(deductionAmount(1_000_000, 3.3), 33_000);
    assert.equal(deductionAmount(2_345_678, 3.3), 77_407); // 77.407,374
  });

  test('4 bảo hiểm ước tính 9,4%', () => {
    assert.equal(deductionAmount(2_000_000, 9.4), 188_000);
  });

  test('tỉ lệ 0, âm hoặc tổng 0 thì không khấu trừ', () => {
    assert.equal(deductionAmount(1_000_000, 0), 0);
    assert.equal(deductionAmount(1_000_000, -1), 0);
    assert.equal(deductionAmount(0, 3.3), 0);
  });
});
