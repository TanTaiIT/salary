import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdTokenVerifier } from '../src/lib/idToken.ts';
import { createFakeIdp } from './fakeIdp.ts';
import { config } from './helpers.ts';
import { loadConfig } from '../src/config.ts';

const idp = await createFakeIdp();
const rejectsWith = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: { code?: string }) => e.code === code);

describe('Kiểm tra id token', () => {
  test('token Google hợp lệ trả sub và name', async () => {
    const token = await idp.sign('google', { sub: 'g-123', name: ' Lan ' });
    assert.deepEqual(await idp.verifier.verify('google', token), { sub: 'g-123', name: 'Lan' });
  });

  test('chấp nhận mọi client id trong danh sách', async () => {
    const token = await idp.sign('google', { sub: 'g-1' }, { aud: 'google-client-ios' });
    assert.equal((await idp.verifier.verify('google', token)).sub, 'g-1');
  });

  test('token Apple không có name thì chỉ trả sub', async () => {
    const token = await idp.sign('apple', { sub: 'a-1' });
    assert.deepEqual(await idp.verifier.verify('apple', token), { sub: 'a-1' });
  });

  test('hết hạn, sai aud, sai iss, khóa lạ, token rác đều là invalid_id_token', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    await rejectsWith(idp.verifier.verify('google', await idp.sign('google', {}, { expSec: past })), 'invalid_id_token');
    await rejectsWith(idp.verifier.verify('apple', await idp.sign('apple', {}, { aud: 'com.other.app' })), 'invalid_id_token');
    await rejectsWith(idp.verifier.verify('apple', await idp.sign('google')), 'invalid_id_token');
    await rejectsWith(idp.verifier.verify('google', await idp.sign('google', {}, { foreignKey: true })), 'invalid_id_token');
    await rejectsWith(idp.verifier.verify('google', 'not.a.jwt.at.all'), 'invalid_id_token');
  });

  test('nhà cung cấp không có client id thì chưa cấu hình', async () => {
    const v = createIdTokenVerifier({});
    assert.equal(v.isConfigured('apple'), false);
    await rejectsWith(v.verify('apple', 'x'), 'provider_not_configured');
  });
});

describe('Cấu hình đăng nhập', () => {
  test('danh sách client id tách theo dấu phẩy, bỏ khoảng trắng và phần tử rỗng', () => {
    const c = loadConfig({
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://unused',
      JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
      APPLE_CLIENT_IDS: ' a, b ,,',
    });
    assert.deepEqual(c.socialLogin.apple, ['a', 'b']);
    assert.deepEqual(c.socialLogin.google, []);
  });

  test('mặc định không bật nhà cung cấp nào', () => {
    assert.deepEqual(config.socialLogin, { apple: [], google: [] });
  });
});
