import { randomUUID } from 'node:crypto';
import { Id, JobInput } from '../schemas/index.ts';
import { HttpError, created, ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import { isDuplicateKey, type JobDoc } from '../db/client.ts';
import { jobToApi } from '../services/jobs.ts';

/** id không bắt buộc: app tạo UUID khi offline, nên gửi lên luôn để không phải đổi id về sau */
export const CreateJobRequest = JobInput.extend({ id: Id.optional() });

export function jobRoutes(r: Router): void {
  r.get('/v1/jobs', async ({ deps, userId }) => {
    const jobs = await deps.cols.jobs.find({ userId, deletedAt: null }).sort({ createdAt: 1 }).toArray();
    return ok({ items: jobs.map(jobToApi) });
  });

  r.post('/v1/jobs', async ({ deps, userId, body }) => {
    const { id, ...input } = parse(CreateJobRequest, await body());
    const now = new Date();
    const job: JobDoc = {
      _id: id ?? randomUUID(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      serverUpdatedAt: now,
    };
    try {
      await deps.cols.jobs.insertOne(job);
    } catch (err) {
      if (isDuplicateKey(err)) throw new HttpError(409, 'job_exists', 'Nơi làm việc với id này đã tồn tại', { id: job._id });
      throw err;
    }
    return created(jobToApi(job));
  });
}
