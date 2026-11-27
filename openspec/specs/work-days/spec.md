# Work Days Specification

## Purpose

Ghi, sửa, xóa và xem ngày công theo tháng. Id ngày công là UUID do app tạo để có thể tạo khi offline rồi đồng bộ sau. Xung đột giải quyết theo nguyên tắc bản sửa mới nhất thắng, dựa trên `updatedAt` (giờ máy người dùng).

## Requirements

### Requirement: Xem ngày công trong tháng

`GET /v1/work-days?month=YYYY-MM&jobId=` MUST trả `{ month, items, summary }`: `items` là các ngày công chưa xóa của người dùng trong tháng (lọc theo `jobId` nếu có), sắp theo ngày tăng dần, mỗi phần tử kèm `note` (ghi chú, `""` nếu không có, kể cả bản ghi tạo trước khi có ghi chú) và `pay` tính bằng `wageSnapshot` của chính ngày đó; `summary` là tổng lương tháng theo spec payroll, gồm cả 주휴수당 của những tuần có ngày Chủ nhật nằm trong tháng.

#### Scenario: Tính theo lương giờ lưu cùng ngày công

- **WHEN** ngày công có `wageSnapshot = 10030` còn nơi làm việc hiện có `hourlyWage = 10320`
- **THEN** tiền công ngày đó tính bằng 10.030 ₩

#### Scenario: 주휴수당 của tuần vắt qua tháng

- **WHEN** có khoản 주휴수당 của tuần bắt đầu `2026-10-26` (Chủ nhật là `2026-11-01`)
- **THEN** khoản này được tính vào tháng `2026-11`, không tính vào tháng `2026-10`

#### Scenario: Ngày công của nơi làm đã xóa

- **WHEN** nơi làm việc đã xóa mềm nhưng app chưa gửi lệnh xóa các ngày công của nơi làm đó
- **THEN** các ngày công đó vẫn có trong `items` và `summary`; app chịu trách nhiệm xóa chúng khi xóa nơi làm

#### Scenario: Thiếu hoặc sai tham số tháng

- **WHEN** gọi `GET /v1/work-days?month=2026-13`
- **THEN** server trả 422 với `error.code = "validation_failed"`

### Requirement: Tạo hoặc sửa một ngày công

`PUT /v1/work-days/:id` MUST tạo mới hoặc ghi đè ngày công có id đó cho người dùng trong token, chỉ khi `jobId` là nơi làm việc chưa xóa của người dùng. Nếu bản trên server có `updatedAt` mới hơn hoặc bằng bản gửi lên, server MUST giữ bản server và trả 409. Mỗi người dùng chỉ có một ngày công chưa xóa cho mỗi nơi làm và mỗi ngày.

#### Scenario: Tạo mới

- **WHEN** gửi ngày công hợp lệ với id UUID chưa tồn tại
- **THEN** server trả 200 với ngày công vừa ghi kèm `pay`

#### Scenario: Bản gửi lên cũ hơn bản server

- **WHEN** gửi bản có `updatedAt` cũ hơn bản đang lưu
- **THEN** server trả 409 với `error.code = "stale_update"` và `details` là bản đang lưu trên server

#### Scenario: Trùng ngày với ngày công khác

- **WHEN** gửi id mới cho cùng nơi làm và cùng ngày với một ngày công chưa xóa khác
- **THEN** server trả 409 với `error.code = "duplicate_day"`

#### Scenario: Nơi làm việc không tồn tại

- **WHEN** gửi `jobId` không thuộc người dùng hoặc đã xóa
- **THEN** server trả 422 với `error.code = "unknown_job"`

#### Scenario: Id thuộc người dùng khác

- **WHEN** gửi id của một ngày công thuộc người dùng khác
- **THEN** server trả 404 với `error.code = "not_found"` và không thay đổi bản của người kia

#### Scenario: Id không phải UUID

- **WHEN** gọi `PUT /v1/work-days/abc`
- **THEN** server trả 422 với `error.code = "validation_failed"`

### Requirement: Xóa mềm ngày công

`DELETE /v1/work-days/:id` MUST đặt `deletedAt`, `updatedAt` và `serverUpdatedAt` bằng thời điểm hiện tại thay vì xóa hẳn, để các máy khác nhận được việc xóa khi đồng bộ, rồi trả 204.

#### Scenario: Xóa thành công

- **WHEN** xóa một ngày công chưa xóa của mình
- **THEN** server trả 204 và ngày công không còn trong `GET /v1/work-days`

#### Scenario: Xóa ngày công không có hoặc đã xóa

- **WHEN** xóa id không tồn tại, đã xóa, hoặc thuộc người dùng khác
- **THEN** server trả 404 với `error.code = "not_found"`
