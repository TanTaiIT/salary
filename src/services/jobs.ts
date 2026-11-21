import type { JobChange } from '../schemas/index.ts';
import { isDuplicateKey, type Collections, type JobDoc } from '../db/client.ts';
import { HttpError } from '../lib/http.ts';

export type JobApplyResult = { status: 'applied' | 'stale'; doc: JobDoc };

/**
 * Ghi một thay đổi nơi làm việc theo nguyên tắc "bản sửa mới nhất thắng",
 * cùng luật với applyWorkDayChange.
 */
export async function applyJobChange(
  cols: Collections,
  userId: string,
  change: JobChange,
  now = new Date(),
): Promise<JobApplyResult> {
  const { id, data } = change;
  const incomingAt = new Date(data.updatedAt);
  const existing = await cols.jobs.findOne({ _id: id });
  if (existing && existing.userId !== userId) {
    throw new HttpError(404, 'not_found', 'Không tìm thấy nơi làm việc', { id });
  }
  if (existing && existing.updatedAt >= incomingAt) {
    return { status: 'stale', doc: existing };
  }

  const doc: JobDoc = {
    _id: id,
    userId,
    name: data.name,
    hourlyWage: data.hourlyWage,
    companySize: data.companySize,
    createdAt: existing?.createdAt ?? now,
    updatedAt: incomingAt,
    deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
    serverUpdatedAt: now,
  };

  try {
    await cols.jobs.replaceOne({ _id: id, userId }, doc, { upsert: true });
  } catch (err) {
    // Trùng _id với nơi làm việc của người khác được tạo cùng lúc
    if (isDuplicateKey(err)) throw new HttpError(404, 'not_found', 'Không tìm thấy nơi làm việc', { id });
    throw err;
  }
  return { status: 'applied', doc };
}

export function jobToApi(j: JobDoc) {
  return {
    id: j._id,
    name: j.name,
    hourlyWage: j.hourlyWage,
    companySize: j.companySize,
    updatedAt: j.updatedAt.toISOString(),
  };
}

/** Bản dùng cho đồng bộ: có deletedAt để máy khác nhận được việc xóa */
export function jobToSyncApi(j: JobDoc) {
  return { ...jobToApi(j), deletedAt: j.deletedAt?.toISOString() ?? null };
}
