# Rules Specification

## Purpose

Quy định theo năm (lương tối thiểu, ngày lễ, điều kiện 주휴수당) lưu trong collection `ruleSets`, không viết cứng trong code. App tải về và lưu đệm; khi luật đổi chỉ cần cập nhật server.

## Requirements

### Requirement: Xem quy định của năm

`GET /v1/rules/:year` MUST không cần đăng nhập và trả `{ year, minimumWage, holidays, weeklyHoliday, updatedAt }` của năm đó, với `holidays` là danh sách `{ date, name }` và `weeklyHoliday` là `{ minHours, maxHours, paidHours }`.

#### Scenario: Năm đã có quy định

- **WHEN** gọi `GET /v1/rules/2026` sau khi đã nạp quy định 2026
- **THEN** server trả 200 với `minimumWage = 10320` và `weeklyHoliday = { minHours: 15, maxHours: 40, paidHours: 8 }`

#### Scenario: Năm sai dạng

- **WHEN** gọi `GET /v1/rules/26`
- **THEN** server trả 400 với `error.code = "bad_year"`

#### Scenario: Năm chưa có quy định

- **WHEN** gọi `GET /v1/rules/2030` khi chưa nạp quy định năm 2030
- **THEN** server trả 404 với `error.code = "not_found"`

### Requirement: Nạp quy định

Script `pnpm seed` MUST ghi (tạo mới hoặc thay thế) quy định năm 2026 vào `ruleSets`, nên chạy lại nhiều lần vẫn cho cùng kết quả.

#### Scenario: Chạy seed hai lần

- **WHEN** chạy `pnpm seed` hai lần
- **THEN** `ruleSets` chỉ có một bản ghi `_id = "2026"`
