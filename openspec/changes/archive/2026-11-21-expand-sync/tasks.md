# Tasks

## 1. Hạ tầng test với MongoDB thật

- [x] 1.1 Thêm `test/db.ts` (kết nối `MONGODB_TEST_URI`, database riêng mỗi file, `ensureIndexes`, xóa khi xong, tự bỏ qua khi không kết nối được); kiểm tra bằng test tích hợp `GET /v1/jobs` của người dùng mới trả `items` rỗng

## 2. Schema dùng chung

- [x] 2.1 Thêm `WeeklyHolidayPayInput`, `WeeklyHolidayPayChange` và `weeklyHolidayPays` (≤ 500, mặc định rỗng) vào `SyncRequest`; kiểm tra bằng test trong `test/schemas.test.ts` cho `weekStart` không phải thứ Hai, amount lẻ, tên nơi làm toàn khoảng trắng, `companySize` sai, gói kiểu cũ vẫn hợp lệ

## 3. 주휴수당

- [x] 3.1 Tạo `src/services/weeklyHolidayPays.ts` (`applyWeeklyHolidayPayChange`, `weeklyToApi`) theo design; kiểm tra bằng test tích hợp: ghi mới, `stale`, `duplicate_week`, ghi lại được sau khi bản cũ đã xóa mềm, `unknown_job`
- [x] 3.2 `/v1/sync` ghi `weeklyHolidayPays` sau workDays, trả `weeklyHolidayPayResults`, kéo về `weeklyHolidayPays` cùng `nextCursor`; kiểm tra bằng test tích hợp: nơi làm mới và 주휴수당 cùng gói, gói kiểu cũ, khoản 30.960 ₩ tuần `2026-11-16` xuất hiện trong `GET /v1/work-days?month=2026-11` ở `summary.weeklyHolidayPay`

## 4. Đồng bộ trên MongoDB thật

- [x] 4.1 `firstOpenAt` ở tương lai được giới hạn bằng thời điểm hiện tại; kiểm tra bằng test tích hợp cho scenario "Giờ máy ở tương lai" và "Cài lại app"
- [x] 4.2 Kiểm tra phân trang và các luật có sẵn trên MongoDB thật; test tích hợp: 2.300 ngày công gọi lặp theo `hasMore` nhận đủ 2.300 id, `duplicate_day` qua index một phần, xóa ngày công của nơi làm đã xóa mềm được chấp nhận

## 5. Nơi làm việc và người dùng

- [x] 5.1 `POST /v1/jobs` nhận `id` không bắt buộc, trả 409 `job_exists` khi trùng; kiểm tra bằng test tích hợp cho id do app tạo, id trùng, không gửi id
- [x] 5.2 Kiểm tra dev-login tạo người dùng với `role = "user"`, `firstSeenAt` và bỏ qua `role` client gửi; kiểm tra bằng test tích hợp

## 6. Tài liệu và kiểm tra cuối

- [x] 6.1 Cập nhật README (bảng API, cách chạy test tích hợp, bỏ mục 주휴수당 khỏi Việc tiếp theo) và mục Đồng bộ offline trong `docs/spec.md`; kiểm tra bằng cách đọc lại khớp spec delta
- [x] 6.2 Chạy `pnpm test`, `pnpm typecheck` và `openspec validate expand-sync --strict`, tất cả đều qua
