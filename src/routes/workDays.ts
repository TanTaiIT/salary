import { addDays, monthRange, monthSummary } from '../payroll/index.ts';
import { Id, MonthString, WorkDayInput } from '../schemas/index.ts';
import { HttpError, noContent, ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import { userJobIds, applyWorkDayChange, toApi } from '../services/workDays.ts';

export function workDayRoutes(r: Router): void {
  // GET /v1/work-days?month=2026-11&jobId=...
  r.get('/v1/work-days', async ({ deps, userId, query }) => {
    const month = parse(MonthString, query.get('month'));
    const jobId = query.get('jobId') ?? undefined;
    const { from, to } = monthRange(month);

    const days = await deps.cols.workDays
      .find({ userId, deletedAt: null, date: { $gte: from, $lte: to }, ...(jobId ? { jobId } : {}) })
      .sort({ date: 1 })
      .toArray();

    // 주휴수당 thuộc tháng có ngày Chủ nhật cuối tuần đó
    const weekly = await deps.cols.weeklyHolidayPays
      .find({
        userId,
        deletedAt: null,
        weekStart: { $gte: addDays(from, -6), $lte: addDays(to, -6) },
        ...(jobId ? { jobId } : {}),
      })
      .toArray();

    const summary = monthSummary(
      days.map((d) => ({ date: d.date, hours: d.hours, allowance: d.allowance, wage: d.wageSnapshot })),
      weekly.map((w) => ({ weekStart: w.weekStart, amount: w.amount })),
    );
    return ok({ month, items: days.map(toApi), summary });
  });

  // PUT /v1/work-days/:id  (tạo mới hoặc sửa; id là UUID do app tạo)
  r.put('/v1/work-days/:id', async ({ deps, userId, params, body }) => {
    const id = parse(Id, params.id);
    const data = parse(WorkDayInput, await body());
    const jobIds = await userJobIds(deps.cols, userId);
    const result = await applyWorkDayChange(deps.cols, userId, { id, data, deletedAt: null }, jobIds);
    if (result.status === 'stale') {
      throw new HttpError(409, 'stale_update', 'Ngày công đã được sửa ở nơi khác sau bản này', toApi(result.doc));
    }
    return ok(toApi(result.doc));
  });

  // DELETE /v1/work-days/:id  (xóa mềm để các máy khác đồng bộ được việc xóa)
  r.delete('/v1/work-days/:id', async ({ deps, userId, params }) => {
    const id = parse(Id, params.id);
    const now = new Date();
    const res = await deps.cols.workDays.updateOne(
      { _id: id, userId, deletedAt: null },
      { $set: { deletedAt: now, updatedAt: now, serverUpdatedAt: now } },
    );
    if (res.matchedCount === 0) throw new HttpError(404, 'not_found', 'Không tìm thấy ngày công');
    return noContent();
  });
}
