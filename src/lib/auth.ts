import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError } from './http.ts';

export type TokenType = 'access' | 'refresh';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Cặp token kèm thông tin của refresh token để lưu phiên; không trả nguyên object này ra API. */
export interface IssuedTokens extends TokenPair {
  refreshJti: string;
  refreshExpiresAt: Date;
}

export interface TokenClaims {
  userId: string;
  jti: string;
}

/** Chỉ ký và kiểm tra JWT, không chạm database. Lưu và thu hồi phiên nằm ở services/sessions.ts. */
export interface Auth {
  issue(userId: string): Promise<IssuedTokens>;
  /** Trả về userId và jti nếu token hợp lệ và đúng loại */
  verify(token: string, type: TokenType): Promise<TokenClaims>;
}

export interface AuthOptions {
  secret: string;
  issuer: string;
  accessTtlSec: number;
  refreshTtlSec: number;
}

export function createAuth(opts: AuthOptions): Auth {
  const key = new TextEncoder().encode(opts.secret);

  const sign = (userId: string, typ: TokenType, jti: string, nowSec: number, ttlSec: number) =>
    new SignJWT({ typ })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(opts.issuer)
      .setAudience(opts.issuer)
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + ttlSec)
      .setJti(jti)
      .sign(key);

  return {
    async issue(userId) {
      const nowSec = Math.floor(Date.now() / 1000);
      const refreshJti = randomUUID();
      const [accessToken, refreshToken] = await Promise.all([
        sign(userId, 'access', randomUUID(), nowSec, opts.accessTtlSec),
        sign(userId, 'refresh', refreshJti, nowSec, opts.refreshTtlSec),
      ]);
      return {
        accessToken,
        refreshToken,
        expiresIn: opts.accessTtlSec,
        refreshJti,
        refreshExpiresAt: new Date((nowSec + opts.refreshTtlSec) * 1000),
      };
    },

    async verify(token, type) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: opts.issuer,
          audience: opts.issuer,
          algorithms: ['HS256'],
        });
        if (payload.typ !== type || !payload.sub || !payload.jti) throw new Error('wrong token type');
        return { userId: payload.sub, jti: payload.jti };
      } catch {
        throw new HttpError(401, 'invalid_token', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
      }
    },
  };
}

export function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
