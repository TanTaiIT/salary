import type { Router } from '../lib/router.ts';

export function healthRoutes(r: Router): void {
  r.get(
    '/health',
    async ({ deps }) => {
      const db = await deps.ping().catch(() => false);
      return {
        status: db ? 200 : 503,
        body: { status: db ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) },
      };
    },
    { auth: false },
  );
}
