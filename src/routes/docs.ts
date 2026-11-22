import { ok } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import { buildOpenApiDocument } from '../openapi/document.ts';

// Swagger UI tải từ CDN, ghim phiên bản; trang này chỉ có ngoài production.
const SWAGGER_UI = 'https://unpkg.com/swagger-ui-dist@5.17.14';

const DOCS_HTML = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lịch Lương API</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css">
</head>
<body>
  <div id="swagger"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger', persistAuthorization: true });
  </script>
</body>
</html>`;

export function docsRoutes(r: Router): void {
  // Dựng một lần: tài liệu không đổi khi server đang chạy
  let doc: ReturnType<typeof buildOpenApiDocument> | undefined;
  r.get('/openapi.json', () => ok((doc ??= buildOpenApiDocument())), { auth: false });
  r.get('/docs', () => ({ status: 200, raw: DOCS_HTML, headers: { 'content-type': 'text/html; charset=utf-8' } }), {
    auth: false,
  });
}
