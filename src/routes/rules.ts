import type { RuleSetDoc } from '../db/client.ts';
import { HttpError, ok } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';

export function parseYear(raw: string | undefined): string {
  const year = raw ?? '';
  if (!/^\d{4}$/.test(year)) throw new HttpError(400, 'bad_year', 'Năm phải có 4 chữ số');
  return year;
}

/** Chỉ các trường công khai; không để lộ updatedBy */
export const rulesToApi = (r: RuleSetDoc) => ({
  year: r.year,
  minimumWage: r.minimumWage,
  holidays: r.holidays,
  weeklyHoliday: r.weeklyHoliday,
  updatedAt: r.updatedAt.toISOString(),
});

export function ruleRoutes(r: Router): void {
  r.get(
    '/v1/rules/:year',
    async ({ deps, params }) => {
      const year = parseYear(params.year);
      const rules = await deps.cols.ruleSets.findOne({ _id: year });
      if (!rules) throw new HttpError(404, 'not_found', `Chưa có quy định cho năm ${year}`);
      return ok(rulesToApi(rules));
    },
    { auth: false },
  );
}
