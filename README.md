# Lịch Lương Hàn Quốc: backend

Monorepo Node.js thuần (không framework), TypeScript chạy trực tiếp bằng Node, MongoDB.

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
apps/api/              API HTTP
  src/server.ts        khởi động, kết nối MongoDB, tắt an toàn
  src/app.ts           xử lý request: request id, rate limit, router, xác thực, lỗi
  src/config.ts        đọc và kiểm tra biến môi trường
  src/lib/             router, đọc body, JWT, rate limit, logger
  src/db/client.ts     kiểu document, collection, index
  src/services/        logic ghi ngày công (bản sửa mới nhất thắng)
  src/routes/          health, auth, rules, jobs, work-days, sync
  scripts/seed-rules.ts nạp quy định năm 2026
packages/payroll-core/ tính lương thuần TypeScript, dùng chung với app React Native
packages/shared/       schema zod dùng chung
```

## Chạy lần đầu

```bash
corepack enable                       # hoặc: npm i -g pnpm
pnpm install
docker compose up -d                  # MongoDB 8, replica set 1 node
cp apps/api/.env.example apps/api/.env  # rồi sửa JWT_SECRET
pnpm --filter @llhq/api seed          # nạp quy định 2026
pnpm dev                              # http://localhost:3000/health
```

Kiểm tra: `pnpm test` và `pnpm typecheck`.

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
| POST | /v1/auth/refresh | không |
| GET | /v1/rules/:year | không |
| GET, POST | /v1/jobs | có |
| GET | /v1/work-days?month=YYYY-MM&jobId= | có |
| PUT, DELETE | /v1/work-days/:id | có |
| POST | /v1/sync | có |

## Việc tiếp theo

- Đăng nhập Apple, Google, Kakao (xác minh id token bằng `createRemoteJWKSet` của jose).
- Thu hồi refresh token (lưu jti trong MongoDB) và xoay vòng khi refresh.
- Route và đồng bộ cho 주휴수당 (collection `weeklyHolidayPays` đã có index).
- Rate limit bằng Redis khi chạy nhiều instance.
