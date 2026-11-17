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

export interface Auth {
  issue(userId: string): Promise<TokenPair>;
  /** Trả về userId nếu token hợp lệ và đúng loại */
  verify(token: string, type: TokenType): Promise<string>;
}

export interface AuthOptions {
  secret: string;
  issuer: string;
  accessTtlSec: number;
  refreshTtlSec: number;
}

export function createAuth(opts: AuthOptions): Auth {
  const key = new TextEncoder().encode(opts.secret);

  const sign = (userId: string, typ: TokenType, ttlSec: number) =>
    new SignJWT({ typ })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(opts.issuer)
      .setAudience(opts.issuer)
      .setIssuedAt()
      .setExpirationTime(`${ttlSec}s`)
      .setJti(randomUUID())
      .sign(key);

  return {
    async issue(userId) {
      const [accessToken, refreshToken] = await Promise.all([
        sign(userId, 'access', opts.accessTtlSec),
        sign(userId, 'refresh', opts.refreshTtlSec),
      ]);
      return { accessToken, refreshToken, expiresIn: opts.accessTtlSec };
    },

    async verify(token, type) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: opts.issuer,
          audience: opts.issuer,
          algorithms: ['HS256'],
        });
        if (payload.typ !== type || !payload.sub) throw new Error('wrong token type');
        return payload.sub;
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
