import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { RuleSetInput } from '../schemas/index.ts';
import type { AuditLogDoc, RuleSetDoc } from '../db/client.ts';
import { ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import { parseYear, rulesToApi } from './rules.ts';

const AuditQuery = z.object({
  target: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const auditToApi = (a: AuditLogDoc) => ({
  id: a._id,
  actorId: a.actorId,
  action: a.action,
  target: a.target,
  before: a.before,
  after: a.after,
  at: a.at.toISOString(),
});

export function adminRoutes(r: Router): void {
  r.get(
    '/v1/admin/rules',
    async ({ deps }) => {
      const items = await deps.cols.ruleSets.find().sort({ year: -1 }).toArray();
      return ok({ items: items.map((x) => ({ ...rulesToApi(x), updatedBy: x.updatedBy ?? null })) });
    },
    { admin: true },
  );

  // Tạo hoặc thay thế quy định một năm; mọi thay đổi ghi vào auditLogs kèm giá trị cũ và mới
  r.put(
    '/v1/admin/rules/:year',
    async ({ deps, params, userId, body }) => {
      const year = parseYear(params.year);
      const input = parse(RuleSetInput, await body());
      parse(
        z.array(z.object({ date: z.string().startsWith(`${year}-`, `Ngày lễ phải thuộc năm ${year}`) })),
        input.holidays,
      );

      const now = new Date();
      const before = await deps.cols.ruleSets.findOne({ _id: year });
      const doc: RuleSetDoc = {
        _id: year,
        year: Number(year),
        minimumWage: input.minimumWage,
        holidays: [...input.holidays].sort((a, b) => a.date.localeCompare(b.date)),
        weeklyHoliday: input.weeklyHoliday,
        updatedAt: now,
        updatedBy: userId,
      };
      await deps.cols.ruleSets.replaceOne({ _id: year }, doc, { upsert: true });
      await deps.cols.auditLogs.insertOne({
        _id: randomUUID(),
        actorId: userId,
        action: before ? 'rules.update' : 'rules.create',
        target: `ruleSets/${year}`,
        before: before ?? null,
        after: doc,
        at: now,
      });
      return ok({ ...rulesToApi(doc), updatedBy: userId });
    },
    { admin: true },
  );

  // GET /v1/admin/audit-logs?target=ruleSets/2026&limit=50  (mới nhất trước)
  r.get(
    '/v1/admin/audit-logs',
    async ({ deps, query }) => {
      const q = parse(AuditQuery, {
        target: query.get('target') ?? undefined,
        limit: query.get('limit') ?? undefined,
      });
      const items = await deps.cols.auditLogs
        .find(q.target ? { target: q.target } : {})
        .sort({ at: -1 })
        .limit(q.limit)
        .toArray();
      return ok({ items: items.map(auditToApi) });
    },
    { admin: true },
  );
}
