// Ghi tài liệu OpenAPI ra openapi.json ở gốc repo. App sinh kiểu TypeScript từ file này (pnpm gen:api ở repo app).
// Chạy lại sau mỗi lần đổi route hoặc schema; test/openapi.test.ts báo lỗi nếu file cũ.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument } from '../src/openapi/document.ts';

export const OPENAPI_FILE = resolve(import.meta.dirname, '..', 'openapi.json');

export const renderOpenApi = () => `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;

if (import.meta.main) {
  writeFileSync(OPENAPI_FILE, renderOpenApi());
  console.log(`Đã ghi ${OPENAPI_FILE}`);
}
