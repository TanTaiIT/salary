// Tài liệu OpenAPI phải khớp route thật và file openapi.json đã commit, để app không sinh kiểu từ tài liệu cũ.
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { OPENAPI_FILE, renderOpenApi } from '../scripts/openapi.ts';
import { OPERATIONS, buildOpenApiDocument, toRouterPath } from '../src/openapi/document.ts';
import * as R from '../src/openapi/responses.ts';
import { buildRouter } from '../src/routes/index.ts';
import { json, startTestServer } from './helpers.ts';

const DOC_ROUTES = new Set(['GET /openapi.json', 'GET /docs']);

describe('Tài liệu OpenAPI', () => {
  test('mọi route có trong tài liệu và ngược lại, đúng yêu cầu đăng nhập', () => {
    const routes = buildRouter('development').list().filter((r) => !DOC_ROUTES.has(`${r.method} ${r.path}`));
    const documented = OPERATIONS.map((o) => `${o.method.toUpperCase()} ${toRouterPath(o.path)}`);
    assert.deepEqual(routes.map((r) => `${r.method} ${r.path}`).sort(), [...documented].sort());

    for (const r of routes) {
      const op = OPERATIONS.find((o) => o.method.toUpperCase() === r.method && toRouterPath(o.path) === r.path)!;
      const expected = r.admin ? 'admin' : r.auth ? 'user' : 'none';
      assert.equal(op.auth, expected, `${r.method} ${r.path}`);
    }
  });

  test('operationId không trùng, mọi $ref trỏ tới schema có thật', () => {
    const ids = OPERATIONS.map((o) => o.operationId);
    assert.equal(new Set(ids).size, ids.length);
    const doc = buildOpenApiDocument();
    const refs = [...JSON.stringify(doc).matchAll(/"#\/components\/schemas\/(\w+)"/g)].map((m) => m[1]!);
    for (const name of refs) assert.ok(name in doc.components.schemas, name);
  });

  test('openapi.json đã commit là bản mới nhất (chạy pnpm openapi nếu lỗi)', () => {
    assert.equal(readFileSync(OPENAPI_FILE, 'utf8').replace(/\r\n/g, '\n'), renderOpenApi());
  });

  test('production không có dev-login và không có trang tài liệu', () => {
    const prod = buildRouter('production').list().map((r) => `${r.method} ${r.path}`);
    assert.ok(!prod.includes('POST /v1/auth/dev-login'));
    assert.ok(!prod.includes('GET /docs'));
  });
});

describe('Route tài liệu', () => {
  let t: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => { t = await startTestServer(); });
  after(async () => { await t.close(); });

  test('GET /openapi.json trả tài liệu, GET /docs trả trang HTML', async () => {
    const doc = await json(await fetch(`${t.base}/openapi.json`));
    assert.equal(doc.openapi, '3.1.0');
    assert.ok(doc.paths['/v1/sync'].post);
    const page = await fetch(`${t.base}/docs`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await page.text(), /swagger-ui/);
  });

  test('lỗi thật khớp ErrorResponse; /health khớp HealthResponse', async () => {
    const err = await json(await fetch(`${t.base}/khong-co`));
    assert.equal(R.ErrorResponse.safeParse(err).success, true);
    const health = await json(await fetch(`${t.base}/health`));
    assert.equal(R.HealthResponse.safeParse(health).success, true);
  });
});
