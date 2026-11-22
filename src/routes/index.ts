import { Router } from '../lib/router.ts';
import { adminRoutes } from './admin.ts';
import { appConfigRoutes } from './appConfig.ts';
import { authRoutes } from './auth.ts';
import { docsRoutes } from './docs.ts';
import { healthRoutes } from './health.ts';
import { jobRoutes } from './jobs.ts';
import { meRoutes } from './me.ts';
import { ruleRoutes } from './rules.ts';
import { syncRoutes } from './sync.ts';
import { workDayRoutes } from './workDays.ts';

export function buildRouter(env: string): Router {
  const r = new Router();
  healthRoutes(r);
  appConfigRoutes(r);
  authRoutes(r, env);
  ruleRoutes(r);
  jobRoutes(r);
  workDayRoutes(r);
  syncRoutes(r);
  meRoutes(r);
  adminRoutes(r);
  // Tài liệu API (Swagger UI) chỉ bật ngoài production, giống dev-login
  if (env !== 'production') docsRoutes(r);
  return r;
}
