import { SyncRequest } from '@llhq/shared';
import { ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import { activeJobIds, applyWorkDayChange, toApi } from '../services/workDays.ts';

/**
 * Đồng bộ hai chiều:
 * 1. App đẩy các ngày công đã thay đổi kể từ lần trước.
 * 2. Server trả về mọi bản ghi có serverUpdatedAt sau mốc "since",
 *    cùng serverTime để app dùng làm mốc cho lần sau.
 * App nhận lại có thể trùng bản mình vừa gửi; gộp theo id là được.
 */
export function syncRoutes(r: Router): void {
  r.post('/v1/sync', async ({ deps, userId, body }) => {
    const input = parse(SyncRequest, await body());
    const jobIds = await activeJobIds(deps.cols, userId);

    const results: { id: string; status: 'applied' | 'stale' | 'rejected'; code?: string }[] = [];
    for (const change of input.workDays) {
      try {
        const r = await applyWorkDayChange(deps.cols, userId, change, jobIds);
        results.push({ id: change.id, status: r.status });
      } catch (err) {
        const code = err instanceof Error && 'code' in err ? String(err.code) : 'error';
        results.push({ id: change.id, status: 'rejected', code });
      }
    }

    const serverTime = new Date();
    const since = input.since ? new Date(input.since) : new Date(0);
    const changed = await deps.cols.workDays
      .find({ userId, serverUpdatedAt: { $gt: since, $lte: serverTime } })
      .sort({ serverUpdatedAt: 1 })
      .limit(2_000)
      .toArray();

    // Nếu còn dữ liệu, mốc tiếp theo là bản ghi cuối cùng đã trả; app gọi lại /v1/sync với mốc đó
    const hasMore = changed.length === 2_000;
    const cursor = hasMore ? changed[changed.length - 1]!.serverUpdatedAt : serverTime;

    return ok({
      serverTime: cursor.toISOString(),
      results,
      workDays: changed.map(toApi),
      hasMore,
    });
  });
}
