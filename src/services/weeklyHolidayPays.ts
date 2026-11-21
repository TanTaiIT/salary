import type { WeeklyHolidayPayChange } from '../schemas/index.ts';
import { isDuplicateKey, type Collections, type WeeklyHolidayPayDoc } from '../db/client.ts';
import { HttpError } from '../lib/http.ts';
import type { UserJobIds } from './workDays.ts';

export type WeeklyApplyResult = { status: 'applied' | 'stale'; doc: WeeklyHolidayPayDoc };

/**
 * Ghi một khoản 주휴수당 theo nguyên tắc "bản sửa mới nhất thắng", cùng luật với applyWorkDayChange.
 * Lưu đúng amount app gửi: app tính bằng src/payroll và người dùng đã xác nhận.
 */
export async function applyWeeklyHolidayPayChange(
  cols: Collections,
  userId: string,
  change: WeeklyHolidayPayChange,
  jobIds: UserJobIds,
  now = new Date(),
): Promise<WeeklyApplyResult> {
  const { id, data } = change;
  const allowed = change.deletedAt ? jobIds.owned : jobIds.active;
  if (!allowed.has(data.jobId)) {
    throw new HttpError(422, 'unknown_job', 'Nơi làm việc không tồn tại', { id, jobId: data.jobId });
  }

  const incomingAt = new Date(data.updatedAt);
  const existing = await cols.weeklyHolidayPays.findOne({ _id: id });
  if (existing && existing.userId !== userId) {
    throw new HttpError(404, 'not_found', 'Không tìm thấy khoản 주휴수당', { id });
  }
  if (existing && existing.updatedAt >= incomingAt) {
    return { status: 'stale', doc: existing };
  }

  const doc: WeeklyHolidayPayDoc = {
    _id: id,
    userId,
    jobId: data.jobId,
    weekStart: data.weekStart,
    amount: data.amount,
    updatedAt: incomingAt,
    deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    serverUpdatedAt: now,
  };

  try {
    await cols.weeklyHolidayPays.replaceOne({ _id: id, userId }, doc, { upsert: true });
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new HttpError(409, 'duplicate_week', 'Tuần này đã có một khoản 주휴수당 khác', { id, weekStart: data.weekStart });
    }
    throw err;
  }
  return { status: 'applied', doc };
}

export function weeklyToApi(doc: WeeklyHolidayPayDoc) {
  return {
    id: doc._id,
    jobId: doc.jobId,
    weekStart: doc.weekStart,
    amount: doc.amount,
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString() ?? null,
  };
}
