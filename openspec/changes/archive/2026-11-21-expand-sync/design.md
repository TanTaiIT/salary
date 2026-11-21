# Design

## Context

Xem proposal.md (Why). Code hiện có (từ phiên trước):
- `src/services/workDays.ts`: `applyWorkDayChange` và `userJobIds` trả `{ active, owned }`.
- `src/services/jobs.ts`: `applyJobChange`, cùng luật "bản sửa mới nhất thắng".
- `src/routes/sync.ts`: ghi jobs rồi workDays; `nextCursor(since, serverTime, lists)` tính mốc cho bất kỳ số danh sách nào; `firstOpenAt` lưu bằng `$min`.
- Test trong `test/routes.test.ts` dùng collection giả trong bộ nhớ.

## Goals / Non-Goals

**Goals:**
- 주휴수당 theo đúng một luật ghi với ngày công.
- Có test chạy trên MongoDB thật cho những gì collection giả không kiểm được: index unique một phần (`partialFilterExpression`), lỗi trùng khóa 11000, upsert, `$min`, phân trang nhiều bản.

**Non-Goals:**
- Gộp ba hàm ghi thành một hàm chung: ba hàm hiện tại đã cùng luật và đã có test. Gộp lại không đổi hành vi, để khi cần mới làm.

## Decisions

### `applyWeeklyHolidayPayChange`

Tạo `src/services/weeklyHolidayPays.ts`, theo cùng cấu trúc với `applyWorkDayChange`:
1. Kiểm tra `jobId`: xóa thì cần `owned`, tạo hoặc sửa thì cần `active` (dùng lại `userJobIds`). Không đạt thì 422 `unknown_job`.
2. Bản theo `_id` thuộc người khác thì 404 `not_found`.
3. `updatedAt` trên server mới hơn hoặc bằng thì trả `stale`.
4. Ghi bằng `replaceOne({ _id, userId }, doc, { upsert: true })`. Lỗi 11000 xảy ra khi đụng index `uniq_active_week` (hoặc `_id` của người khác được tạo cùng lúc) thì trả 409 `duplicate_week`.

`weekStart` phải là thứ Hai: kiểm tra ngay trong schema bằng `dayOfWeek` của `src/payroll`, nên app cũng bị chặn trước khi gửi.

### `/v1/sync`

- Thứ tự xử lý: jobs, rồi `userJobIds`, rồi workDays, rồi weeklyHolidayPays. Tập nơi làm tính một lần sau khi ghi jobs là đủ, vì ngày công không đổi nơi làm.
- Kéo về thêm một truy vấn `weeklyHolidayPays`; `nextCursor` nhận ba danh sách và dùng lại không cần sửa.
- `firstOpenAt`: `$min` với `min(firstOpenAt, now)`.

### `POST /v1/jobs` nhận `id`

Body là `JobInput.extend({ id: Id.optional() })`. Dùng `insertOne`; lỗi 11000 thì trả 409 `job_exists`. Id trùng với nơi làm của người khác cũng trả 409. Việc này để lộ rằng UUID đó đã tồn tại, nhưng UUID ngẫu nhiên nên không khai thác được gì.

### Test tích hợp

`test/db.ts` mở kết nối tới `MONGODB_TEST_URI` (mặc định `mongodb://localhost:27017/?replicaSet=rs0&directConnection=true`, timeout 2 giây). Mỗi file test tạo database `llhq_test_<ngẫu nhiên>`, chạy `ensureIndexes`, và `dropDatabase` khi xong. Không kết nối được thì `describe(..., { skip: 'lý do' })`, nên `pnpm test` vẫn qua trên máy không có Docker. `startTestServer` đã nhận `cols` qua `overrides`, nên không cần sửa helpers.

## Risks / Trade-offs

- [Amount 주휴수당 do app gửi, server không kiểm tra] → Hai bên dùng chung `src/payroll`; kiểm tra phía server để cho change sau nếu thấy lệch thật.
- [Test tích hợp bị bỏ qua lặng lẽ khi Docker tắt] → Lý do skip in ra trong kết quả `node --test`; README ghi rõ cần `docker compose up -d`.

## Migration Plan

Không đổi dữ liệu cũ và không thêm index. Muốn quay lại thì gỡ code.
