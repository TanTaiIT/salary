// Schema dùng chung cho app React Native và API: cùng một luật kiểm tra ở cả hai nơi.
import { z } from 'zod';
import { isValidDate, totalHours } from '@llhq/payroll-core';

export const DateString = z
  .string()
  .refine(isValidDate, { message: 'Ngày phải có dạng YYYY-MM-DD hợp lệ' });

export const MonthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM');

const HalfHours = z.number().min(0).max(24).multipleOf(0.5, 'Số giờ phải là bội số của 0,5');

export const HoursSchema = z.object({
  x1: HalfHours,
  x1_5: HalfHours,
  x2: HalfHours,
  x2_5: HalfHours,
  x3: HalfHours,
});

const Won = z.number().int().min(0).max(100_000_000);

export const Id = z.uuid();

/** Ngày công app gửi lên. updatedAt là thời điểm sửa trên máy người dùng. */
export const WorkDayInput = z
  .object({
    jobId: z.string().min(1).max(64),
    date: DateString,
    hours: HoursSchema,
    allowance: Won,
    wageSnapshot: z.number().int().min(1).max(1_000_000),
    updatedAt: z.iso.datetime(),
  })
  .refine((v) => totalHours(v.hours) <= 24, {
    message: 'Tổng số giờ trong ngày không được quá 24',
    path: ['hours'],
  });
export type WorkDayInput = z.infer<typeof WorkDayInput>;

/** Một thay đổi trong gói đồng bộ: tạo/sửa (deletedAt = null) hoặc xóa (deletedAt có giá trị). */
export const WorkDayChange = z.object({
  id: Id,
  data: WorkDayInput,
  deletedAt: z.iso.datetime().nullable(),
});
export type WorkDayChange = z.infer<typeof WorkDayChange>;

export const SyncRequest = z.object({
  /** serverTime nhận được ở lần đồng bộ trước; null ở lần đầu */
  since: z.iso.datetime().nullable(),
  workDays: z.array(WorkDayChange).max(500),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export const RefreshRequest = z.object({ refreshToken: z.string().min(10) });

export const DevLoginRequest = z.object({ name: z.string().min(1).max(60) });
