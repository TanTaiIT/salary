# Tasks

## 1. Lõi tính lương dùng chung

- [x] 1.1 `monthSummary` trả thêm `payByType`; kiểm tra bằng test trong `test/payroll/stats.test.ts`: 6 giờ x1 + 2 giờ x1_5 và 8 giờ x1 với 10.320 ₩ ra x1 = 144.480 ₩, x1_5 = 30.960 ₩; hai ngày 0,5 giờ x1_5 với 10.001 ₩ ra 15.001 ₩ (workPay 15.000 ₩)
- [x] 1.2 Thêm `weeklyTotals`, `averageDayPay`, `deductionAmount` trong `src/payroll/stats.ts`; kiểm tra bằng test: tháng 11/2026 có 6 đoạn tuần, 주휴수당 vào đúng đoạn chứa CN, trung bình 89.333 ₩, thuế 3,3% của 2.345.678 ₩ là 77.407 ₩

## 2. Cài đặt người dùng

- [x] 2.1 Thêm `UserSettingsInput` và `settings` (không bắt buộc) vào `SyncRequest`; kiểm tra bằng test trong `test/schemas.test.ts`: 3,3 và 9,4 hợp lệ, 3,33 và 100,1 bị từ chối, gói kiểu cũ vẫn hợp lệ
- [x] 2.2 `src/services/settings.ts` (`applySettings` có điều kiện, `settingsToApi`, `meToApi`); `GET /v1/me`, `PUT /v1/me/settings`; kiểm tra bằng test tích hợp: ghi mới, bản cũ hơn và bằng nhau là 409 `stale_update`, 422 khi sai, 401 khi thiếu token
- [x] 2.3 `/v1/sync` nhận `settings`, trả `settingsResult` và `settings`; kiểm tra bằng test tích hợp hai máy: bản của máy A thắng, máy B nhận lại bản của A, người dùng khác không bị ảnh hưởng

## 3. CORS

- [x] 3.1 `CORS_ORIGINS` trong `src/config.ts`, `src/lib/cors.ts`, gắn vào `src/app.ts`; kiểm tra bằng test trong `test/app.test.ts`: preflight 204, phản hồi lỗi có header CORS, origin lạ không có header và OPTIONS vẫn 405, mặc định tắt

## 4. Tài liệu và kiểm tra cuối

- [x] 4.1 Cập nhật README (bảng API, `CORS_ORIGINS`) và `.env.example`
- [x] 4.2 Chạy `pnpm test` (MongoDB replica set) và `pnpm typecheck`, tất cả đều qua
- [x] 4.3 Chạy `openspec validate support-app-mvp --strict`, qua
- [ ] 4.4 Sau khi duyệt: archive và cập nhật `docs/spec.md` (mục API, Mô hình dữ liệu `users.settings`)
