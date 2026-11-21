# Tasks

## 1. Cấu hình

- [x] 1.1 Thêm `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS` vào `src/config.ts` (tách dấu phẩy, mặc định rỗng) và `.env.example`; kiểm tra bằng unit test `loadConfig` với chuỗi `" a, b ,,"` ra `["a", "b"]`

## 2. Kiểm tra id token

- [x] 2.1 Tạo `src/lib/idToken.ts` (`createIdTokenVerifier`) theo design và đưa vào `Deps`, `server.ts` (JWKS từ xa), `test/helpers.ts` (JWKS cục bộ); kiểm tra bằng unit test: token hợp lệ trả `sub` và `name`, hết hạn, sai `aud`, sai `iss`, ký bằng khóa lạ đều ném lỗi

## 3. Route đăng nhập

- [x] 3.1 Thêm `SocialLoginRequest` vào `src/schemas` và hai route `POST /v1/auth/apple`, `POST /v1/auth/google` (auth: false, limiter auth), dùng chung hàm upsert người dùng với dev-login và cấp token qua `issueSession`; kiểm tra bằng test tích hợp: lần đầu tạo người dùng, lần sau cùng `user.id`, body `{}` trả 422, token sai trả 401 `invalid_id_token`, token Google gửi tới route Apple trả 401, nhà cung cấp chưa cấu hình trả 503, tên mặc định "Người dùng", không lưu email

## 4. Tài liệu và kiểm tra cuối

- [x] 4.1 Cập nhật README (bảng API, biến môi trường) và `docs/spec.md` (bỏ "chưa làm" ở route Apple/Google); kiểm tra bằng cách đọc lại khớp spec delta
- [x] 4.2 Chạy `pnpm test`, `pnpm typecheck` và `openspec validate social-login --strict`, tất cả đều qua
