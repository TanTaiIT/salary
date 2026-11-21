# Proposal

## Why

Giai đoạn Nền tảng chỉ hoàn thành khi đồng bộ đủ dữ liệu và chạy được với MongoDB thật. Phiên làm việc khác đã đưa nơi làm việc và `firstOpenAt` vào `/v1/sync`, nhưng còn thiếu ba việc. Khoản 주휴수당 người dùng đã xác nhận chưa sang được máy khác. `POST /v1/jobs` vẫn do server tạo id. Toàn bộ test hiện chạy trên collection giả, nên index unique, upsert và lỗi trùng khóa của MongoDB chưa được kiểm tra thật.

**Giai đoạn lộ trình:** Nền tảng.

## What Changes

- `/v1/sync` nhận và trả thêm `weeklyHolidayPays`, cùng luật "bản sửa mới nhất thắng" với ngày công. Khoản 주휴수당 được xử lý sau ngày công và trả `weeklyHolidayPayResults`. Trường mới không bắt buộc, nên gói kiểu cũ vẫn chạy.
- Mốc `serverTime` và phân trang tính cả `weeklyHolidayPays`.
- `firstOpenAt` ở tương lai không được làm `firstSeenAt` vượt quá thời điểm hiện tại của server.
- `POST /v1/jobs` nhận thêm `id` (UUID do app tạo), không bắt buộc; id trùng trả 409 `job_exists`.
- Ghi vào spec luật đã có trong code: người dùng mới có `role = "user"` và `firstSeenAt`; schema nơi làm việc.
- Thêm test tích hợp chạy với MongoDB thật. Test tự bỏ qua khi không kết nối được.

## Ngoài phạm vi

- Server tự tính lại hoặc kiểm tra số tiền 주휴수당 app gửi lên (app tính bằng `src/payroll`, người dùng xác nhận).
- Route riêng `PUT`/`DELETE /v1/jobs/:id`: app sửa, xóa nơi làm qua `/v1/sync`.
- Viết lại các test trên collection giả của phiên trước; chỉ thêm test tích hợp bên cạnh.
- CI: repo chưa có git và chưa có nơi chạy CI.

## Ảnh hưởng đến app

- `src/schemas` có thêm `WeeklyHolidayPayInput`, `WeeklyHolidayPayChange`, và `SyncRequest` có thêm `weeklyHolidayPays`. Cần chép lại sang app.
- App gửi `weeklyHolidayPays` sau khi người dùng xác nhận 주휴수당, và gộp `weeklyHolidayPays` nhận về theo id.

## Capabilities

### New Capabilities

- `weekly-holiday-pay`: khoản 주휴수당 người dùng đã xác nhận cho một tuần của một nơi làm, và luật ghi của nó.

### Modified Capabilities

- `sync`: thêm 주휴수당 vào đẩy lên và kéo về; `firstOpenAt` không vượt thời điểm hiện tại.
- `jobs`: `POST /v1/jobs` nhận id do app tạo.
- `validation`: thêm schema nơi làm việc và 주휴수당.
- `auth`: người dùng mới có `role` và `firstSeenAt`.

## Impact

- Code: `src/schemas/index.ts`, `src/services/` (thêm luật ghi 주휴수당), `src/routes/sync.ts`, `src/routes/jobs.ts`.
- MongoDB: không thêm index (index `uniq_active_week` và `user_sync` của `weeklyHolidayPays` đã có).
- Test: `test/db.ts` (kết nối `MONGODB_TEST_URI`, mặc định là MongoDB trong docker-compose) và file test tích hợp mới.
- Tài liệu: README (API, cách chạy test tích hợp), `docs/spec.md` (mục Đồng bộ offline).
