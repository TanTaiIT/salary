# Proposal

## Why

App React Native đã có giao diện theo prototype: lịch tháng, bảng chấm công, gợi ý 주휴수당, Thống kê, Lịch sử và Cài đặt (lương giờ, mức khấu trừ, chế độ màu). So với các tính năng đó, server còn ba chỗ hở:

1. App tự tính tiền theo loại giờ, lương theo tuần và khấu trừ trong code riêng của app, nên không có gì bảo đảm app và server (báo cáo PDF sau này) ra cùng một con số, trái với mục tiêu "lệch 0 won".
2. Mức khấu trừ người dùng chọn chỉ nằm trên máy, nên đổi máy là mất, trái với mục tiêu "dữ liệu không mất khi đổi máy". Màn Cài đặt cũng chưa có route để lấy thông tin tài khoản.
3. Bản web của app (Expo web) gọi API từ trình duyệt, khác origin, nhưng server không trả header CORS, nên trình duyệt chặn cả `GET /v1/rules/:year`.

**Giai đoạn lộ trình:** MVP. Phần Thống kê và Lương thực nhận thuộc Giai đoạn 2 theo docs/spec.md, nhưng app đã làm, nên người dùng yêu cầu server theo kịp.

## What Changes

- `src/payroll`:
  - `monthSummary` trả thêm `payByType`, tiền công theo từng loại giờ cả tháng (trường mới, không phá vỡ tương thích).
  - Thêm `weeklyTotals` (lương theo đoạn tuần T2–CN trong tháng).
  - Thêm `averageDayPay` (trung bình mỗi ngày làm).
  - Thêm `deductionAmount` (khấu trừ ước tính theo tỉ lệ phần trăm, bước 0,1).
- `src/schemas`: thêm `UserSettingsInput` (`deductRate`, `updatedAt`); `SyncRequest` nhận thêm `settings`, không bắt buộc.
- Cài đặt người dùng lưu trong `users.settings`, ghi theo "bản sửa mới nhất thắng":
  - `GET /v1/me`: tên, cách đăng nhập, `firstOpenAt`, `settings`.
  - `PUT /v1/me/settings`: bản cũ hơn trả 409 `stale_update`.
  - `/v1/sync`: nhận `settings`, trả `settingsResult` và `settings`.
- CORS theo danh sách `CORS_ORIGINS` (trống là tắt), có trả lời preflight `OPTIONS`.

## Ngoài phạm vi

- Route REST `PUT`/`DELETE /v1/jobs/:id`, `/v1/weekly-holiday-pays/:id`: giữ quyết định của change `expand-sync`, app sửa, xóa qua `/v1/sync`.
- Đồng bộ chế độ màu và nơi làm đang chọn: đây là lựa chọn riêng từng máy.
- Route `/v1/stats`: app tính thống kê trên máy (offline) bằng `src/payroll`; server dùng lại khi làm báo cáo PDF.
- Quy định năm 2027 (lương tối thiểu, ngày lễ): admin nhập qua `PUT /v1/admin/rules/2027` khi có số liệu chính thức. Không viết cứng.
- Client đồng bộ trong app (gọi `/v1/sync`, đăng nhập).

## Ảnh hưởng đến app

- Chạy `pnpm sync-shared` để chép `src/payroll` và `src/schemas`.
- Màn Thống kê dùng `summary.payByType` và `weeklyTotals`. Trung bình mỗi ngày dùng `averageDayPay`, lương thực nhận dùng `deductionAmount`, thay cho code riêng của app.
- Khi làm đồng bộ: app gửi `settings` (kèm `updatedAt` lúc đổi mức khấu trừ) và áp dụng `settings` nhận về.
- Bản web của app cần server đặt `CORS_ORIGINS` (dev: `http://localhost:8081`).

## Capabilities

### New Capabilities

Không có.

### Modified Capabilities

- `payroll`: tổng tháng có `payByType`; thêm lương theo tuần, trung bình mỗi ngày, khấu trừ ước tính.
- `validation`: thêm schema cài đặt người dùng; gói đồng bộ có `settings`.
- `account`: thêm xem tài khoản và sửa cài đặt.
- `sync`: đồng bộ cài đặt.
- `http-api`: CORS.

## Impact

- Code: `src/payroll/summary.ts`, `src/payroll/stats.ts` (mới), `src/schemas/index.ts`, `src/services/settings.ts` (mới), `src/routes/me.ts`, `src/routes/sync.ts`, `src/lib/cors.ts` (mới), `src/app.ts`, `src/config.ts`, `src/db/client.ts`.
- MongoDB: không thêm index (`settings` nằm trong `users`, truy vấn theo `_id`).
- Cấu hình: biến môi trường mới `CORS_ORIGINS`.
- Tài liệu: README (bảng API, biến môi trường), `docs/spec.md` (mục API, Mô hình dữ liệu) khi archive.
