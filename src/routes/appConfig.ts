import { DEFAULT_AD_CONFIG } from '../schemas/index.ts';
import { ok } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';

export function appConfigRoutes(r: Router): void {
  // Cấu hình app: quảng cáo và phiên bản tối thiểu. App lưu đệm 12 giờ.
  r.get(
    '/v1/config',
    async ({ deps }) => {
      const doc = await deps.cols.appConfig.findOne({ _id: 'current' });
      return ok({
        ads: doc?.ads ?? DEFAULT_AD_CONFIG,
        minAppVersion: doc?.minAppVersion ?? '0.0.0',
        updatedAt: doc?.updatedAt.toISOString() ?? null,
      });
    },
    { auth: false },
  );
}
