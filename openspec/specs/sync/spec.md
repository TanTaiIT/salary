# Sync Specification

## Purpose

Đồng bộ hai chiều giữa SQLite trên máy và server qua `POST /v1/sync`, để app dùng được khi offline và dữ liệu không mất khi đổi máy. Đồng bộ nơi làm việc, ngày công, 주휴수당 và `firstOpenAt`.

## Requirements

### Requirement: Đẩy thay đổi lên

`POST /v1/sync` MUST nhận `{ since, workDays }` với tối đa 500 thay đổi, mỗi thay đổi là `{ id, data, deletedAt }`. Server MUST xử lý từng thay đổi theo thứ tự theo cùng luật với `PUT /v1/work-days/:id`, và trả `results` gồm `{ id, status }` cho từng thay đổi, với `status` là `applied`, `stale` hoặc `rejected` (kèm `code`). Một thay đổi bị từ chối MUST NOT làm hỏng các thay đổi khác trong cùng gói.

#### Scenario: Bản mới hơn được ghi

- **WHEN** gửi thay đổi có `updatedAt` mới hơn bản trên server
- **THEN** thay đổi có `status = "applied"`

#### Scenario: Bản cũ hơn bị bỏ qua

- **WHEN** gửi thay đổi có `updatedAt` cũ hơn hoặc bằng bản trên server
- **THEN** thay đổi có `status = "stale"` và bản server giữ nguyên

#### Scenario: Thay đổi lỗi trong gói

- **WHEN** gói có một thay đổi với `jobId` không tồn tại và một thay đổi hợp lệ
- **THEN** thay đổi lỗi có `status = "rejected"` với `code = "unknown_job"`
- **AND** thay đổi hợp lệ vẫn có `status = "applied"`

#### Scenario: Xóa ngày công của nơi làm đã xóa mềm

- **WHEN** gửi thay đổi có `deletedAt` khác null với `jobId` là nơi làm của người dùng đã xóa mềm
- **THEN** thay đổi có `status = "applied"`
- **AND** thay đổi tạo hoặc sửa với `jobId` đó vẫn có `status = "rejected"` với `code = "unknown_job"`

#### Scenario: Hai máy tạo cùng một ngày khi offline

- **WHEN** gửi thay đổi có id khác nhưng cùng nơi làm và cùng ngày với một ngày công chưa xóa
- **THEN** thay đổi có `status = "rejected"` với `code = "duplicate_day"`

#### Scenario: Gói quá 500 thay đổi

- **WHEN** gửi 501 thay đổi trong một lần
- **THEN** server trả 422 với `error.code = "validation_failed"`

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

### Requirement: Đồng bộ nơi làm việc

`POST /v1/sync` MUST nhận thêm `jobs` (không bắt buộc, mặc định rỗng, tối đa 500), mỗi thay đổi là `{ id, data: { name, hourlyWage, companySize, updatedAt }, deletedAt }` với id là UUID do app tạo. Server MUST ghi `jobs` trước `workDays` theo nguyên tắc bản sửa mới nhất thắng, và trả `jobResults` cùng dạng với `results`.

#### Scenario: Nơi làm và ngày công tạo cùng gói

- **WHEN** gói có một nơi làm mới và một ngày công dùng `jobId` của nơi làm đó
- **THEN** cả hai có `status = "applied"`

#### Scenario: Id nơi làm của người dùng khác

- **WHEN** gửi thay đổi nơi làm có id thuộc người dùng khác
- **THEN** thay đổi có `status = "rejected"` với `code = "not_found"`

### Requirement: Lần mở app đầu tiên

`POST /v1/sync` MUST nhận `firstOpenAt` (ISO 8601, không bắt buộc), lưu vào `users.firstSeenAt` giá trị sớm nhất giữa server, máy và thời điểm hiện tại, và luôn trả `firstOpenAt` hiện có của người dùng (hoặc `createdAt` nếu chưa có).

#### Scenario: Cài lại app

- **WHEN** server có `firstSeenAt = 2026-03-01` và máy gửi `firstOpenAt = 2026-09-01`
- **THEN** phản hồi có `firstOpenAt = 2026-03-01`

#### Scenario: Giờ máy ở tương lai

- **WHEN** người dùng chưa có `firstSeenAt` và máy gửi `firstOpenAt` sau thời điểm hiện tại
- **THEN** `firstSeenAt` được lưu bằng thời điểm hiện tại của server, không phải giá trị máy gửi

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
