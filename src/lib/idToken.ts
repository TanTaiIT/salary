// Kiểm tra id token của Apple, Google bằng khóa công khai của nhà cung cấp (JWKS), chỉ dùng jose.
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { HttpError } from './http.ts';
import type { Logger } from './logger.ts';

export type SocialProvider = 'apple' | 'google';

export const PROVIDERS: Record<SocialProvider, { issuer: string | string[]; jwksUrl: string }> = {
  apple: { issuer: 'https://appleid.apple.com', jwksUrl: 'https://appleid.apple.com/auth/keys' },
  google: {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
  },
};

export interface ProviderOptions {
  /** Client id được chấp nhận làm `aud`; rỗng nghĩa là nhà cung cấp chưa được cấu hình */
  audiences: string[];
  issuer: string | string[];
  /** Hàm lấy khóa của jose: JWKS từ xa khi chạy thật, JWKS cục bộ trong test */
  keys: JWTVerifyGetKey;
}

export interface IdTokenClaims {
  sub: string;
  name?: string;
}

export interface IdTokenVerifier {
  isConfigured(provider: SocialProvider): boolean;
  /** Ném 401 invalid_id_token khi token không hợp lệ vì bất kỳ lý do nào */
  verify(provider: SocialProvider, idToken: string): Promise<IdTokenClaims>;
}

const invalid = () => new HttpError(401, 'invalid_id_token', 'Không xác minh được tài khoản đăng nhập, thử lại');

export function createIdTokenVerifier(
  providers: Partial<Record<SocialProvider, ProviderOptions>>,
  logger?: Logger,
): IdTokenVerifier {
  const configured = (p: SocialProvider) => {
    const opts = providers[p];
    return opts && opts.audiences.length > 0 ? opts : null;
  };

  return {
    isConfigured: (p) => configured(p) !== null,

    async verify(provider, idToken) {
      const opts = configured(provider);
      if (!opts) throw new HttpError(503, 'provider_not_configured', 'Chưa bật đăng nhập bằng nhà cung cấp này');
      try {
        const { payload } = await jwtVerify(idToken, opts.keys, {
          issuer: opts.issuer,
          audience: opts.audiences,
          algorithms: ['RS256'],
        });
        if (!payload.sub) throw invalid();
        const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 60) : '';
        return name ? { sub: payload.sub, name } : { sub: payload.sub };
      } catch (err) {
        if (err instanceof HttpError) throw err;
        // Lỗi tải khóa (mạng, timeout) khác với token sai: ghi log để vận hành phát hiện
        if (!(err instanceof errors.JOSEError) || err instanceof errors.JWKSTimeout) {
          logger?.warn('id token key fetch failed', { provider, err });
        }
        throw invalid();
      }
    },
  };
}

/** Bộ kiểm tra chạy thật: khóa tải từ Apple, Google và được jose lưu đệm. */
export function remoteIdTokenVerifier(audiences: Record<SocialProvider, string[]>, logger: Logger): IdTokenVerifier {
  const make = (p: SocialProvider): ProviderOptions => ({
    audiences: audiences[p],
    issuer: PROVIDERS[p].issuer,
    keys: createRemoteJWKSet(new URL(PROVIDERS[p].jwksUrl)),
  });
  return createIdTokenVerifier({ apple: make('apple'), google: make('google') }, logger);
}
