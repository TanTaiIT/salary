# Spec Delta

## ADDED Requirements

### Requirement: Dữ liệu nơi làm việc

Hệ thống MUST chấp nhận dữ liệu nơi làm việc chỉ khi: `name` dài 1 đến 60 ký tự sau khi bỏ khoảng trắng hai đầu; `hourlyWage` là số nguyên won từ 1 đến 1.000.000; `companySize` là `under5` hoặc `5plus`; và, khi đồng bộ, `updatedAt` là thời điểm ISO 8601.

#### Scenario: Tên chỉ có khoảng trắng

- **WHEN** gửi nơi làm việc có `name = "   "`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `name`

#### Scenario: Quy mô công ty không hợp lệ

- **WHEN** gửi `companySize = "big"`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `companySize`

### Requirement: Dữ liệu 주휴수당

Hệ thống MUST chấp nhận một khoản 주휴수당 chỉ khi: `jobId` là chuỗi 1 đến 64 ký tự; `weekStart` là ngày hợp lệ dạng `"YYYY-MM-DD"` và là thứ Hai; `amount` là số nguyên won từ 0 đến 100.000.000; `updatedAt` là thời điểm ISO 8601.

#### Scenario: Tuần không bắt đầu từ thứ Hai

- **WHEN** gửi `weekStart = "2026-11-22"` (Chủ nhật)
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `weekStart`

#### Scenario: Số tiền lẻ

- **WHEN** gửi `amount = 30960.5`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `amount`
