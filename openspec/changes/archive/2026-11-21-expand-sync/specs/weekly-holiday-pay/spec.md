# Spec Delta

## Purpose

Lưu khoản lương ngày nghỉ tuần (주휴수당) người dùng đã xác nhận cho một tuần của một nơi làm, để khoản này có trong tổng lương tháng và theo người dùng sang máy khác.

## ADDED Requirements

### Requirement: Ghi khoản 주휴수당

Server MUST ghi khoản 주휴수당 gửi qua `/v1/sync` theo nguyên tắc bản sửa mới nhất thắng dựa trên `updatedAt`, với id UUID do app tạo, và lưu đúng `amount` app gửi lên. Tạo hoặc sửa MUST yêu cầu `jobId` là nơi làm việc chưa xóa của người dùng; xóa (`deletedAt` khác null) chỉ yêu cầu nơi làm việc thuộc người dùng.

#### Scenario: Người dùng xác nhận 주휴수당

- **WHEN** app gửi khoản `{ jobId, weekStart: "2026-11-16", amount: 30960 }` với id mới
- **THEN** khoản có `status = "applied"`
- **AND** `GET /v1/work-days?month=2026-11` có `summary.weeklyHolidayPay = 30960`

#### Scenario: Nơi làm việc không tồn tại

- **WHEN** gửi khoản với `jobId` không thuộc người dùng
- **THEN** khoản có `status = "rejected"` với `code = "unknown_job"`

### Requirement: Một khoản mỗi tuần mỗi nơi làm

Mỗi người dùng MUST chỉ có một khoản 주휴수당 chưa xóa cho mỗi nơi làm và mỗi tuần.

#### Scenario: Hai máy cùng xác nhận một tuần khi offline

- **WHEN** gửi khoản có id khác nhưng cùng `jobId` và `weekStart` với một khoản chưa xóa
- **THEN** khoản có `status = "rejected"` với `code = "duplicate_week"`

#### Scenario: Xác nhận lại sau khi xóa

- **WHEN** khoản cũ của tuần đó đã bị xóa mềm và app gửi khoản mới cùng tuần
- **THEN** khoản mới có `status = "applied"`
