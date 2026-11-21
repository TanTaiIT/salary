# Spec Delta

## MODIFIED Requirements

### Requirement: Kéo thay đổi về

Server MUST trả `jobs`, `workDays` và `weeklyHolidayPays` của người dùng (kể cả bản đã xóa mềm) có `serverUpdatedAt` sau `since` (`null` là từ đầu), sắp tăng dần, tối đa 2.000 bản mỗi loại, cùng `hasMore` và `serverTime`. Nếu một loại đủ 2.000 bản: `hasMore = true`, `serverTime` là T trừ 1 ms (T là bản cuối sớm nhất trong các loại đủ), mọi loại chỉ trả bản không sau `serverTime`. Nếu không: `serverTime` là lúc xử lý lùi 5 giây, không sớm hơn `since`.

#### Scenario: Lần đồng bộ đầu tiên

- **WHEN** gửi `since = null`
- **THEN** server trả mọi nơi làm việc, ngày công và 주휴수당 của người dùng cùng `serverTime`

#### Scenario: Nhận được việc xóa từ máy khác

- **WHEN** máy A xóa một ngày công, sau đó máy B đồng bộ với `since` trước thời điểm xóa
- **THEN** máy B nhận ngày công đó với `deletedAt` khác null

#### Scenario: Còn dữ liệu

- **WHEN** có hơn 2.000 bản thay đổi sau `since`
- **THEN** server trả `hasMore = true` và `serverTime` sớm hơn 1 ms so với `serverUpdatedAt` của bản thứ 2.000
- **AND** không bản nào có cùng `serverUpdatedAt` với bản thứ 2.000 bị bỏ sót ở lần gọi sau

#### Scenario: Gọi lặp theo hasMore nhận đủ dữ liệu

- **WHEN** có 2.300 ngày công thay đổi sau `since` và app gọi lại với `since = serverTime` cho tới khi `hasMore = false`
- **THEN** app nhận đủ 2.300 ngày công

### Requirement: Lần mở app đầu tiên

`POST /v1/sync` MUST nhận `firstOpenAt` (ISO 8601, không bắt buộc), lưu vào `users.firstSeenAt` giá trị sớm nhất giữa server, máy và thời điểm hiện tại, và luôn trả `firstOpenAt` hiện có của người dùng (hoặc `createdAt` nếu chưa có).

#### Scenario: Cài lại app

- **WHEN** server có `firstSeenAt = 2026-03-01` và máy gửi `firstOpenAt = 2026-09-01`
- **THEN** phản hồi có `firstOpenAt = 2026-03-01`

#### Scenario: Giờ máy ở tương lai

- **WHEN** người dùng chưa có `firstSeenAt` và máy gửi `firstOpenAt` sau thời điểm hiện tại
- **THEN** `firstSeenAt` được lưu bằng thời điểm hiện tại của server, không phải giá trị máy gửi

## ADDED Requirements

### Requirement: Đồng bộ 주휴수당

`POST /v1/sync` MUST nhận thêm `weeklyHolidayPays` (không bắt buộc, mặc định rỗng, tối đa 500), mỗi thay đổi là `{ id, data: { jobId, weekStart, amount, updatedAt }, deletedAt }` với id là UUID do app tạo. Server MUST ghi chúng sau `workDays` theo luật của spec weekly-holiday-pay, và trả `weeklyHolidayPayResults` cùng dạng với `results`.

#### Scenario: Gói kiểu cũ

- **WHEN** gửi gói không có `weeklyHolidayPays`
- **THEN** server xử lý bình thường và `weeklyHolidayPayResults` là mảng rỗng

#### Scenario: Nơi làm mới và 주휴수당 cùng gói

- **WHEN** gói có một nơi làm mới và một khoản 주휴수당 dùng `jobId` của nơi làm đó
- **THEN** cả hai có `status = "applied"`

#### Scenario: Gói quá 500 khoản

- **WHEN** gửi 501 khoản 주휴수당 trong một lần
- **THEN** server trả 422 với `error.code = "validation_failed"`
