import { dayPay } from '../payroll/index.ts';
import type { WorkDayChange } from '../schemas/index.ts';
import { isDuplicateKey, type Collections, type WorkDayDoc } from '../db/client.ts';
import { HttpError } from '../lib/http.ts';

export type ApplyResult = { status: 'applied' | 'stale'; doc: WorkDayDoc };

export interface UserJobIds {
  /** Nơi làm chưa xóa: bắt buộc khi tạo hoặc sửa ngày công */
  active: Set<string>;
  /** Mọi nơi làm của người dùng, kể cả đã xóa mềm: đủ cho thay đổi xóa ngày công */
  owned: Set<string>;
}

export async function userJobIds(cols: Collections, userId: string): Promise<UserJobIds> {
  const jobs = await cols.jobs.find({ userId }, { projection: { _id: 1, deletedAt: 1 } }).toArray();
  return {
    active: new Set(jobs.filter((j) => j.deletedAt == null).map((j) => j._id)),
    owned: new Set(jobs.map((j) => j._id)),
  };
}

/**
 * Ghi một thay đổi ngày công theo nguyên tắc "bản sửa mới nhất thắng":
 * nếu bản trên server có updatedAt mới hơn hoặc bằng, giữ bản server và trả về "stale".
 */
export async function applyWorkDayChange(
  cols: Collections,
  userId: string,
  change: WorkDayChange,
  jobIds: UserJobIds,
  now = new Date(),
): Promise<ApplyResult> {
  const { id, data } = change;
  // Xóa ngày công của nơi làm đã xóa mềm vẫn hợp lệ (app xóa nơi làm thì xóa luôn các ngày của nó)
  const allowed = change.deletedAt ? jobIds.owned : jobIds.active;
  if (!allowed.has(data.jobId)) {
    throw new HttpError(422, 'unknown_job', 'Nơi làm việc không tồn tại', { id, jobId: data.jobId });
  }

  const incomingAt = new Date(data.updatedAt);
  const existing = await cols.workDays.findOne({ _id: id });
  if (existing && existing.userId !== userId) {
    throw new HttpError(404, 'not_found', 'Không tìm thấy ngày công', { id });
  }
  if (existing && existing.updatedAt >= incomingAt) {
    return { status: 'stale', doc: existing };
  }

  const doc: WorkDayDoc = {
    _id: id,
    userId,
    jobId: data.jobId,
    date: data.date,
    hours: data.hours,
    allowance: data.allowance,
    wageSnapshot: data.wageSnapshot,
    updatedAt: incomingAt,
    deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    serverUpdatedAt: now,
  };

  try {
    await cols.workDays.replaceOne({ _id: id, userId }, doc, { upsert: true });
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new HttpError(409, 'duplicate_day', 'Ngày này đã có một ngày công khác', { id, date: data.date });
    }
    throw err;
  }
  return { status: 'applied', doc };
}

export function toApi(doc: WorkDayDoc) {
  return {
    id: doc._id,
    jobId: doc.jobId,
    date: doc.date,
    hours: doc.hours,
    allowance: doc.allowance,
    wageSnapshot: doc.wageSnapshot,
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString() ?? null,
    pay: dayPay({ date: doc.date, hours: doc.hours, allowance: doc.allowance, wage: doc.wageSnapshot }),
  };
}
