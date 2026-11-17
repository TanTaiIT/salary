import { Router } from '../lib/router.ts';
import { authRoutes } from './auth.ts';
import { healthRoutes } from './health.ts';
import { jobRoutes } from './jobs.ts';
import { ruleRoutes } from './rules.ts';
import { syncRoutes } from './sync.ts';
import { workDayRoutes } from './workDays.ts';

export function buildRouter(env: string): Router {
  const r = new Router();
  healthRoutes(r);
  authRoutes(r, env);
  ruleRoutes(r);
  jobRoutes(r);
  workDayRoutes(r);
  syncRoutes(r);
  return r;
}
