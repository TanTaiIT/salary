import { randomUUID } from 'node:crypto';
import { DevLoginRequest, RefreshRequest } from '@llhq/shared';
import { ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';

export function authRoutes(r: Router, env: string): void {
  r.post(
    '/v1/auth/refresh',
    async ({ deps, body }) => {
      const { refreshToken } = parse(RefreshRequest, await body());
      const userId = await deps.auth.verify(refreshToken, 'refresh');
      return ok(await deps.auth.issue(userId));
    },
    { auth: false, limiter: 'auth' },
  );

  // Chỉ để phát triển: đăng nhập bằng tên, không cần Apple/Google.
  // Không bao giờ được đăng ký ở production.
  if (env !== 'production') {
    r.post(
      '/v1/auth/dev-login',
      async ({ deps, body }) => {
        const { name } = parse(DevLoginRequest, await body());
        const user = await deps.cols.users.findOneAndUpdate(
          { provider: 'dev', providerId: name },
          { $setOnInsert: { _id: randomUUID(), name, provider: 'dev', providerId: name, createdAt: new Date() } },
          { upsert: true, returnDocument: 'after' },
        );
        if (!user) throw new Error('Không tạo được người dùng');
        return ok({ user: { id: user._id, name: user.name }, ...(await deps.auth.issue(user._id)) });
      },
      { auth: false, limiter: 'auth' },
    );
  }

  // TODO: /v1/auth/apple, /v1/auth/google, /v1/auth/kakao
  // Xác minh id token của nhà cung cấp bằng jose (createRemoteJWKSet), rồi upsert user như trên.
}
