# Proposal

## Why

App React Native đang gọi API bằng kiểu viết tay, nên khi server đổi route hay trường dữ liệu thì app chỉ phát hiện lúc chạy. Server chưa có tài liệu API máy đọc được. Cần một tài liệu OpenAPI luôn khớp code, để app sinh kiểu TypeScript từ đó và người làm app xem được API trên Swagger UI.

**Giai đoạn lộ trình:** MVP (app kết nối API: đăng nhập, đồng bộ).

## What Changes

- Sinh tài liệu OpenAPI 3.1 từ các schema zod đang dùng để kiểm tra dữ liệu gửi lên (`src/schemas`), cộng schema zod mới cho dữ liệu trả về (`src/openapi/responses.ts`, chỉ ở server). Không thêm thư viện: zod 4 có sẵn `z.toJSONSchema`.
- `GET /openapi.json` và `GET /docs` (Swagger UI tải từ CDN, ghim phiên bản), chỉ đăng ký ngoài production, giống `dev-login`.
- `pnpm openapi` ghi `openapi.json` ở gốc repo; file này được commit để repo app sinh kiểu mà không cần server chạy.
- Test bảo đảm tài liệu khớp code:
  - Mọi route của router đều có trong tài liệu và ngược lại, đúng yêu cầu đăng nhập.
  - `openapi.json` đã commit là bản mới nhất.
  - Phản hồi thật của các route chính khớp schema phản hồi (kiểm tra strict, nên trường chưa ghi vào tài liệu cũng bị bắt).
- `Router.list()` liệt kê route; `Reply.raw` để trả trang HTML.

## Ngoài phạm vi

- Kiểm tra mọi phản hồi theo schema khi chạy thật (chỉ kiểm trong test).
- Sinh client SDK phía server; app tự sinh kiểu bằng `openapi-typescript`.
- Bật tài liệu ở production.

## Ảnh hưởng đến app

- App thêm `pnpm gen:api` (openapi-typescript) đọc `../salary/openapi.json` và gọi API bằng `openapi-fetch` theo kiểu đã sinh.
- Không đổi hành vi API nào, không đổi `src/payroll` hay `src/schemas`.

## Capabilities

### New Capabilities

Không có.

### Modified Capabilities

- `http-api`: thêm tài liệu OpenAPI và Swagger UI.

## Impact

- Code: `src/openapi/` (mới), `src/routes/docs.ts` (mới), `src/routes/index.ts`, `src/routes/jobs.ts` và `src/routes/admin.ts` (export schema), `src/lib/router.ts`, `src/lib/http.ts`, `scripts/openapi.ts` (mới), `openapi.json` (mới).
- MongoDB: không đổi.
- Test: `test/openapi.test.ts`, thêm kiểm tra phản hồi trong `test/integration.test.ts`.
