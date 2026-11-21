# Jobs Specification

## Purpose

Nơi làm việc của người dùng: tên, lương giờ, quy mô công ty. Mỗi ngày công thuộc về một nơi làm việc.

## Requirements

### Requirement: Xem nơi làm việc

`GET /v1/jobs` MUST trả `{ items }` gồm các nơi làm việc chưa xóa của người dùng trong token, sắp theo thời điểm tạo tăng dần. Mỗi phần tử có `id`, `name`, `hourlyWage`, `companySize`, `updatedAt`.

#### Scenario: Chỉ thấy nơi làm của mình

- **WHEN** `user-1` gọi `GET /v1/jobs`
- **THEN** danh sách chỉ có nơi làm việc của `user-1`, không có nơi đã xóa mềm

#### Scenario: Thiếu token

- **WHEN** gọi `GET /v1/jobs` không có token
- **THEN** server trả 401 với `error.code = "unauthorized"`

### Requirement: Thêm nơi làm việc

`POST /v1/jobs` MUST nhận `name` (1 đến 60 ký tự sau khi bỏ khoảng trắng hai đầu), `hourlyWage` (số nguyên won từ 1 đến 1.000.000), `companySize` (`under5` hoặc `5plus`) và `id` (UUID do app tạo, không bắt buộc). Nếu không có `id`, server tạo UUID. Server trả 201 kèm nơi làm việc vừa tạo.

#### Scenario: Thêm hợp lệ

- **WHEN** gửi `{ name: "Nhà máy A", hourlyWage: 10320, companySize: "5plus" }`
- **THEN** server trả 201 với `id` là UUID và các trường vừa gửi

#### Scenario: Lương giờ không hợp lệ

- **WHEN** gửi `hourlyWage = 0`
- **THEN** server trả 422 với `error.code = "validation_failed"` và `details` có `path = "hourlyWage"`

#### Scenario: App tự tạo id

- **WHEN** gửi kèm `id` là UUID chưa tồn tại
- **THEN** server trả 201 với đúng `id` đó

#### Scenario: Id đã tồn tại

- **WHEN** gửi `id` đã có nơi làm việc khác dùng
- **THEN** server trả 409 với `error.code = "job_exists"`
