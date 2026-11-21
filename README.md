# Lịch Lương Hàn Quốc: backend

Server Node.js thuần (không framework), TypeScript chạy trực tiếp bằng Node, MongoDB.
App React Native nằm ở repo riêng. Đặc tả đầy đủ: [docs/spec.md](docs/spec.md).

| Thành phần | Phiên bản |
|---|---|
| Node.js | 26 LTS (≥ 26.13) |
| pnpm | 12.21 |
| TypeScript | 7.0 (chỉ dùng để kiểm tra kiểu, Node tự bỏ kiểu khi chạy) |
| mongodb (driver) | 7.9 |
| zod | 4.6 |
| jose | 6.2 |

## Cấu trúc

```
src/
  server.ts            khởi động, kết nối MongoDB, tắt an toàn
  app.ts               xử lý request: request id, rate limit, router, xác thực, lỗi
  config.ts            đọc và kiểm tra biến môi trường
  lib/                 router, đọc body, JWT, rate limit, logger
  db/client.ts         kiểu document, collection, index
  services/            logic ghi ngày công (bản sửa mới nhất thắng)
  routes/              health, auth, rules, jobs, work-days, sync
  payroll/             tính lương thuần TypeScript, không phụ thuộc thư viện nào
  schemas/             schema zod kiểm tra dữ liệu đầu vào
scripts/seed-rules.ts  nạp quy định năm 2026
test/                  test API, payroll, schema
```

`src/payroll/` và `src/schemas/` không import gì từ phần server, nên app React Native
có thể chép nguyên hai thư mục này để tính lương và kiểm tra dữ liệu giống hệt server.

## Chạy lần đầu

```bash
corepack enable                       # hoặc: npm i -g pnpm
pnpm install
docker compose up -d                  # MongoDB 8, replica set 1 node
cp .env.example .env                  # rồi sửa JWT_SECRET
pnpm seed                             # nạp quy định 2026
pnpm dev                              # http://localhost:3000/health
```

Kiểm tra: `pnpm test` và `pnpm typecheck`.

`test/integration.test.ts` chạy với MongoDB thật (mặc định MongoDB trong docker-compose, đổi bằng
`MONGODB_TEST_URI`). Mỗi lần chạy tạo một database `llhq_test_*` riêng và xóa khi xong. Không kết nối
được thì các test này tự bỏ qua, nên nhớ `docker compose up -d` trước khi chạy.

## Làm việc theo OpenSpec

- `docs/spec.md`: đặc tả sản phẩm và lộ trình (làm gì, vì sao, theo thứ tự nào).
- `openspec/specs/`: hành vi server **đang có**, mỗi thư mục là một nhóm tính năng. Đây là nguồn sự thật khi code.
- `openspec/changes/`: thay đổi đang làm. Mỗi tính năng mới đi qua 3 bước trong Claude Code:
  1. `/openspec-propose "mô tả thay đổi"`: tạo proposal, delta spec, design, tasks. Đọc và sửa trước khi làm.
  2. `/openspec-apply-change`: code theo tasks.
  3. `/openspec-archive-change`: gộp delta vào `openspec/specs/` và lưu change vào `changes/archive/`.
- Kiểm tra: `openspec validate --all --strict`. Cài CLI: `npm i -g @fission-ai/openspec`.

## Quy ước

- Import nội bộ ghi rõ đuôi `.ts`; không dùng `enum`, `namespace`, parameter properties (Node chỉ bỏ được cú pháp kiểu thuần).
- Ngày công là chuỗi `"YYYY-MM-DD"` theo giờ Hàn Quốc; tiền là số nguyên won.
- Id ngày công là UUID do app tạo, để tạo khi offline rồi đồng bộ sau.
- Lỗi luôn trả dạng `{ error: { code, message, details }, requestId }`.

## API hiện có

| Phương thức | Đường dẫn | Đăng nhập |
|---|---|---|
| GET | /health | không |
| POST | /v1/auth/dev-login | không (chỉ ngoài production) |
| POST | /v1/auth/refresh | không (xoay vòng, token cũ hết dùng được) |
| POST | /v1/auth/logout | không |
| POST | /v1/auth/apple, /v1/auth/google | không (503 nếu chưa đặt `APPLE_CLIENT_IDS` / `GOOGLE_CLIENT_IDS`) |
| GET | /v1/config | không |
| GET | /v1/rules/:year | không |
| GET, POST | /v1/jobs (POST nhận `id` do app tạo, không bắt buộc) | có |
| GET | /v1/work-days?month=YYYY-MM&jobId= | có |
| PUT, DELETE | /v1/work-days/:id | có |
| POST | /v1/sync | có (nơi làm việc, ngày công, 주휴수당, `firstOpenAt`) |
| DELETE | /v1/me | có |
| GET | /v1/admin/rules | admin |
| PUT | /v1/admin/rules/:year | admin |
| GET | /v1/admin/audit-logs?target=&limit= | admin |

Quyền admin đọc từ `users.role` trong database: `pnpm set-role dev <tên> admin`.
Cấu hình quảng cáo: sửa `scripts/seed-config.ts` rồi chạy `pnpm seed:config`.

## Việc tiếp theo

- Đăng nhập Kakao (giai đoạn 4); `nonce` cho id token Apple, Google.
- Gọi API thu hồi token của Apple khi xóa tài khoản (Apple yêu cầu trước khi phát hành).
- Rate limit bằng Redis khi chạy nhiều instance.
