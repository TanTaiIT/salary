import { HttpError, ok } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';

export function ruleRoutes(r: Router): void {
  r.get(
    '/v1/rules/:year',
    async ({ deps, params }) => {
      const year = params.year ?? '';
      if (!/^\d{4}$/.test(year)) throw new HttpError(400, 'bad_year', 'Năm phải có 4 chữ số');
      const rules = await deps.cols.ruleSets.findOne({ _id: year });
      if (!rules) throw new HttpError(404, 'not_found', `Chưa có quy định cho năm ${year}`);
      const { _id, ...rest } = rules;
      return ok({ ...rest, updatedAt: rules.updatedAt.toISOString() });
    },
    { auth: false },
  );
}
