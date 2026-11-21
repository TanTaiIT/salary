import { SyncRequest } from '../schemas/index.ts';
import { ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import { applyJobChange, jobToSyncApi } from '../services/jobs.ts';
import { applyWeeklyHolidayPayChange, weeklyToApi } from '../services/weeklyHolidayPays.ts';
import { userJobIds, applyWorkDayChange, toApi } from '../services/workDays.ts';

const PULL_LIMIT = 2_000;

type Result = { id: string; status: 'applied' | 'stale' | 'rejected'; code?: string };

/** Lùi mốc một chút để không sót bản ghi mà request khác đã gán serverUpdatedAt nhưng chưa ghi xong */
const SETTLE_MS = 5_000;

/**
 * Tính mốc trả cho app; app chỉ nhận các bản có serverUpdatedAt không sau mốc này.
 * - Còn dữ liệu (một danh sách đủ giới hạn): mốc là T - 1ms, với T là bản cuối sớm nhất trong các danh sách đầy.
 *   Lùi 1ms để không cắt ngang một nhóm bản ghi trùng serverUpdatedAt (lần sau lọc bằng $gt).
 *   Nếu cả trang trùng một thời điểm thì đành dùng T, để app không gọi lại mãi.
 * - Hết dữ liệu: mốc là serverTime lùi SETTLE_MS (không lùi quá since). Lần sau có thể nhận lại vài bản đã có; app gộp theo id.
 */
export function nextCursor(
  since: Date,
  serverTime: Date,
  lists: { serverUpdatedAt: Date }[][],
  limit = PULL_LIMIT,
): { cursor: Date; hasMore: boolean } {
  const full = lists.filter((l) => l.length >= limit);
  if (full.length === 0) {
    return { cursor: new Date(Math.max(since.getTime(), serverTime.getTime() - SETTLE_MS)), hasMore: false };
  }
  const t = Math.min(...full.map((l) => l[l.length - 1]!.serverUpdatedAt.getTime()));
  const before = t - 1;
  const anyBefore = lists.some((l) => l.some((d) => d.serverUpdatedAt.getTime() <= before));
  return { cursor: new Date(anyBefore && before > since.getTime() ? before : t), hasMore: true };
}

const rejectCode =(err: unknown) => (err instanceof Error && 'code' in err ? String(err.code) : 'error');

/**
 * Đồng bộ hai chiều:
 * 1. App đẩy nơi làm việc, ngày công rồi 주휴수당 đã thay đổi kể từ lần trước, cùng firstOpenAt.
 * 2. Server trả về mọi bản ghi có serverUpdatedAt sau mốc "since",
 *    cùng serverTime để app dùng làm mốc cho lần sau.
 * App nhận lại có thể trùng bản mình vừa gửi; gộp theo id là được.
 */
export function syncRoutes(r: Router): void {
  r.post('/v1/sync', async ({ deps, userId, body }) => {
    const input = parse(SyncRequest, await body());
    const { cols } = deps;

    // Nơi làm việc trước, để ngày công trong cùng gói tham chiếu được nơi làm vừa tạo
    const jobResults: Result[] = [];
    for (const change of input.jobs) {
      try {
        jobResults.push({ id: change.id, status: (await applyJobChange(cols, userId, change)).status });
      } catch (err) {
        jobResults.push({ id: change.id, status: 'rejected', code: rejectCode(err) });
      }
    }

    const jobIds = await userJobIds(cols, userId);
    const results: Result[] = [];
    for (const change of input.workDays) {
      try {
        results.push({ id: change.id, status: (await applyWorkDayChange(cols, userId, change, jobIds)).status });
      } catch (err) {
        results.push({ id: change.id, status: 'rejected', code: rejectCode(err) });
      }
    }

    const weeklyHolidayPayResults: Result[] = [];
    for (const change of input.weeklyHolidayPays) {
      try {
        const r = await applyWeeklyHolidayPayChange(cols, userId, change, jobIds);
        weeklyHolidayPayResults.push({ id: change.id, status: r.status });
      } catch (err) {
        weeklyHolidayPayResults.push({ id: change.id, status: 'rejected', code: rejectCode(err) });
      }
    }

    // Giữ lần mở app sớm nhất giữa các máy, để cài lại app không bị coi là người mới.
    // Không nhận thời điểm ở tương lai (giờ máy sai), nếu không cấp quảng cáo sẽ bị tính lệch.
    if (input.firstOpenAt) {
      const firstOpen = new Date(Math.min(Date.parse(input.firstOpenAt), Date.now()));
      await cols.users.updateOne({ _id: userId }, { $min: { firstSeenAt: firstOpen } });
    }
    const user = await cols.users.findOne({ _id: userId }, { projection: { firstSeenAt: 1, createdAt: 1 } });

    const serverTime = new Date();
    const since = input.since ? new Date(input.since) : new Date(0);
    const range = { userId, serverUpdatedAt: { $gt: since, $lte: serverTime } };
    const [jobs, workDays, weeklyHolidayPays] = await Promise.all([
      cols.jobs.find(range).sort({ serverUpdatedAt: 1 }).limit(PULL_LIMIT).toArray(),
      cols.workDays.find(range).sort({ serverUpdatedAt: 1 }).limit(PULL_LIMIT).toArray(),
      cols.weeklyHolidayPays.find(range).sort({ serverUpdatedAt: 1 }).limit(PULL_LIMIT).toArray(),
    ]);

    const { cursor, hasMore } = nextCursor(since, serverTime, [jobs, workDays, weeklyHolidayPays]);
    // Chỉ cắt khi còn dữ liệu; khi hết, bản sau mốc (trong SETTLE_MS) vẫn trả về và sẽ được trả lại lần sau
    const upTo = <T extends { serverUpdatedAt: Date }>(list: T[]) =>
      hasMore ? list.filter((d) => d.serverUpdatedAt <= cursor) : list;

    const firstSeen = user?.firstSeenAt ?? user?.createdAt;
    return ok({
      serverTime: cursor.toISOString(),
      jobResults,
      results,
      weeklyHolidayPayResults,
      jobs: upTo(jobs).map(jobToSyncApi),
      workDays: upTo(workDays).map(toApi),
      weeklyHolidayPays: upTo(weeklyHolidayPays).map(weeklyToApi),
      firstOpenAt: firstSeen?.toISOString() ?? null,
      hasMore,
    });
  });
}
