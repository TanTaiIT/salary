import { DevLoginRequest, LogoutRequest, RefreshRequest, SocialLoginRequest } from '../schemas/index.ts';
import { HttpError, noContent, ok, parse } from '../lib/http.ts';
import type { SocialProvider } from '../lib/idToken.ts';
import type { Router } from '../lib/router.ts';
import { issueSession, revokeSession, rotateSession } from '../services/sessions.ts';
import { findOrCreateUser } from '../services/users.ts';

export function authRoutes(r: Router, env: string): void {
  // Xoay vòng: token cũ hết dùng được, gửi lại token cũ thì mọi phiên của người dùng bị thu hồi
  r.post(
    '/v1/auth/refresh',
    async ({ deps, body }) => {
      const { refreshToken } = parse(RefreshRequest, await body());
      return ok(await rotateSession(deps, refreshToken));
    },
    { auth: false, limiter: 'auth' },
  );

  // Luôn 204 khi body hợp lệ, kể cả token hỏng, để app đăng xuất được trong mọi trường hợp
  r.post(
    '/v1/auth/logout',
    async ({ deps, body }) => {
      const { refreshToken } = parse(LogoutRequest, await body());
      await revokeSession(deps, refreshToken);
      return noContent();
    },
    { auth: false, limiter: 'auth' },
  );

  // Đổi id token của Apple/Google lấy cặp token của server. Người dùng nhận diện theo provider + sub.
  for (const provider of ['apple', 'google'] as const satisfies readonly SocialProvider[]) {
    r.post(
      `/v1/auth/${provider}`,
      async ({ deps, body }) => {
        const input = parse(SocialLoginRequest, await body());
        if (!deps.idTokens.isConfigured(provider)) {
          throw new HttpError(503, 'provider_not_configured', 'Chưa bật đăng nhập bằng nhà cung cấp này');
        }
        const claims = await deps.idTokens.verify(provider, input.idToken);
        const user = await findOrCreateUser(deps.cols, provider, claims.sub, input.name ?? claims.name ?? 'Người dùng');
        return ok({ user: { id: user._id, name: user.name }, ...(await issueSession(deps, user._id)) });
      },
      { auth: false, limiter: 'auth' },
    );
  }

  // Chỉ để phát triển: đăng nhập bằng tên, không cần Apple/Google.
  // Không bao giờ được đăng ký ở production.
  if (env !== 'production') {
    r.post(
      '/v1/auth/dev-login',
      async ({ deps, body }) => {
        const { name } = parse(DevLoginRequest, await body());
        const user = await findOrCreateUser(deps.cols, 'dev', name, name);
        return ok({ user: { id: user._id, name: user.name }, ...(await issueSession(deps, user._id)) });
      },
      { auth: false, limiter: 'auth' },
    );
  }

  // TODO (giai đoạn 4): /v1/auth/kakao
}
