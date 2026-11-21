import { HOUR_KEYS, dayPay, emptyHours, type Hours, type WorkDay } from './pay.ts';

export interface WeeklyPayRecord {
  weekStart: string;
  amount: number;
}

export interface MonthSummary {
  total: number;
  workPay: number;
  allowance: number;
  weeklyHolidayPay: number;
  baseHours: number;
  overtimeHours: number;
  hoursByType: Hours;
  workDays: number;
}

export function monthSummary(days: readonly WorkDay[], weekly: readonly WeeklyPayRecord[] = []): MonthSummary {
  const hoursByType = emptyHours();
  let workPay = 0;
  let allowance = 0;
  let workDays = 0;

  for (const day of days) {
    const pay = dayPay(day);
    workPay += pay.work;
    allowance += pay.allowance;
    let any = false;
    for (const k of HOUR_KEYS) {
      hoursByType[k] += day.hours[k];
      if (day.hours[k] > 0) any = true;
    }
    if (any) workDays++;
  }

  const weeklyHolidayPay = weekly.reduce((s, w) => s + w.amount, 0);
  const overtimeHours = hoursByType.x1_5 + hoursByType.x2 + hoursByType.x2_5 + hoursByType.x3;

  return {
    total: workPay + allowance + weeklyHolidayPay,
    workPay,
    allowance,
    weeklyHolidayPay,
    baseHours: hoursByType.x1,
    overtimeHours,
    hoursByType,
    workDays,
  };
}
