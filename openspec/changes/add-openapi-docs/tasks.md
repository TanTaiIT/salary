# Tasks

## 1. Tài liệu

- [x] 1.1 `src/openapi/responses.ts` (schema phản hồi) và `src/openapi/document.ts` (bảng route, dựng tài liệu bằng `z.toJSONSchema`); kiểm tra bằng test: mọi route có trong tài liệu và ngược lại, đúng yêu cầu đăng nhập, mọi `$ref` trỏ tới schema có thật
- [x] 1.2 `scripts/openapi.ts` và `pnpm openapi` ghi `openapi.json`; kiểm tra bằng test so file đã commit với bản sinh ra

## 2. Route

- [x] 2.1 `Reply.raw`, `GET /openapi.json`, `GET /docs` chỉ ngoài production; kiểm tra bằng test: trả tài liệu và trang HTML, production không có hai route này
- [x] 2.2 Phản hồi thật khớp schema: test tích hợp cho dev-login, refresh, jobs, sync, work-days, me, settings (strict); test thường cho lỗi 404 và `/health`

## 3. Kiểm tra cuối

- [x] 3.1 Cập nhật README (tài liệu API, bảng route)
- [x] 3.2 Chạy `pnpm test` (MongoDB replica set) và `pnpm typecheck`, tất cả đều qua
- [ ] 3.3 Sau khi duyệt: archive cùng `support-app-mvp`
