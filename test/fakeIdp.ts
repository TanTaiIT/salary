// Nhà cung cấp đăng nhập giả: cặp khóa RSA cục bộ để ký id token, không gọi ra mạng.
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from 'jose';
import { PROVIDERS, createIdTokenVerifier, type SocialProvider } from '../src/lib/idToken.ts';

export const AUD = { apple: 'com.test.llhq', google: 'google-client-web' } as const;

export async function createFakeIdp() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  // Khóa lạ cùng kid: chữ ký không khớp khóa công khai đã công bố
  const foreign = await generateKeyPair('RS256');

  const issuerOf = (p: SocialProvider) => {
    const iss = PROVIDERS[p].issuer;
    return Array.isArray(iss) ? iss[0]! : iss;
  };

  async function sign(
    provider: SocialProvider,
    claims: JWTPayload & { name?: string; email?: string } = {},
    opts: { aud?: string; iss?: string; expSec?: number; foreignKey?: boolean } = {},
  ) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(String(claims.sub ?? `${provider}-sub`))
      .setIssuer(opts.iss ?? issuerOf(provider))
      .setAudience(opts.aud ?? AUD[provider])
      .setIssuedAt(now - 10)
      .setExpirationTime(opts.expSec ?? now + 600)
      .sign(opts.foreignKey ? foreign.privateKey : privateKey);
  }

  const verifier = createIdTokenVerifier({
    apple: { audiences: [AUD.apple], issuer: PROVIDERS.apple.issuer, keys },
    google: { audiences: [AUD.google, 'google-client-ios'], issuer: PROVIDERS.google.issuer, keys },
  });

  return { sign, verifier };
}
