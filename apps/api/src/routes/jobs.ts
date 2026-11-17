import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { created, ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import type { JobDoc } from '../db/client.ts';

const JobInput = z.object({
  name: z.string().trim().min(1).max(60),
  hourlyWage: z.number().int().min(1).max(1_000_000),
  companySize: z.enum(['under5', '5plus']),
});

const toApi = (j: JobDoc) => ({
  id: j._id,
  name: j.name,
  hourlyWage: j.hourlyWage,
  companySize: j.companySize,
  updatedAt: j.updatedAt.toISOString(),
});

export function jobRoutes(r: Router): void {
  r.get('/v1/jobs', async ({ deps, userId }) => {
    const jobs = await deps.cols.jobs.find({ userId, deletedAt: null }).sort({ createdAt: 1 }).toArray();
    return ok({ items: jobs.map(toApi) });
  });

  r.post('/v1/jobs', async ({ deps, userId, body }) => {
    const input = parse(JobInput, await body());
    const now = new Date();
    const job: JobDoc = { _id: randomUUID(), userId, ...input, createdAt: now, updatedAt: now, deletedAt: null };
    await deps.cols.jobs.insertOne(job);
    return created(toApi(job));
  });
}
