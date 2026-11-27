# Admin Specification

## Purpose

Route cho trang quản trị: sửa quy định từng năm và xem nhật ký thay đổi. Quyền admin đọc từ `users.role` trong database ở mỗi request, không tin vào token.

## Requirements

### Requirement: Quyền admin

Route khai báo `admin: true` MUST yêu cầu access token hợp lệ, MUST trả 403 với `error.code = "forbidden"` khi `users.role` khác `admin`, và MUST dùng giới hạn tần suất riêng (60 yêu cầu mỗi phút mỗi IP) ngoài giới hạn chung.

#### Scenario: Người dùng thường

- **WHEN** người dùng có `role = "user"` gọi `GET /v1/admin/rules`
- **THEN** server trả 403 với `error.code = "forbidden"`

#### Scenario: Thiếu token

- **WHEN** gọi `GET /v1/admin/rules` không có token
- **THEN** server trả 401 với `error.code = "unauthorized"`

### Requirement: Xem quy định các năm

`GET /v1/admin/rules` MUST trả `{ items }` gồm quy định mọi năm, sắp theo năm giảm dần, mỗi phần tử có các trường của `GET /v1/rules/:year` cùng `updatedBy`.

#### Scenario: Có hai năm

- **WHEN** đã có quy định 2026 và 2027
- **THEN** `items[0].year = 2027`

### Requirement: Sửa quy định một năm

`PUT /v1/admin/rules/:year` MUST nhận `{ minimumWage, holidays, weeklyHoliday }`, tạo mới hoặc thay thế quy định năm đó với `updatedBy` là admin, và ghi một bản `auditLogs` có `actorId`, `action` (`rules.create` hoặc `rules.update`), `target = "ruleSets/<năm>"`, `before`, `after`, `at`. Mọi ngày lễ MUST thuộc đúng năm trong đường dẫn; `minHours` không được lớn hơn `maxHours`.

#### Scenario: Sửa lương tối thiểu

- **WHEN** admin đổi `minimumWage` năm 2026 từ 10.320 thành 10.500
- **THEN** server trả 200 với `minimumWage = 10500`
- **AND** `auditLogs` có bản `action = "rules.update"` với `before.minimumWage = 10320` và `after.minimumWage = 10500`

#### Scenario: Ngày lễ khác năm

- **WHEN** gửi `PUT /v1/admin/rules/2027` có ngày lễ `2026-12-25`
- **THEN** server trả 422 với `error.code = "validation_failed"`

### Requirement: Xem nhật ký thay đổi

`GET /v1/admin/audit-logs?target=&limit=` MUST trả `{ items }` sắp theo `at` giảm dần, lọc theo `target` nếu có, `limit` từ 1 đến 200 (mặc định 50).

#### Scenario: Lọc theo đối tượng

- **WHEN** gọi với `target=ruleSets/2026`
- **THEN** chỉ có các bản ghi thay đổi quy định năm 2026

### Requirement: Cấp quyền

Script `pnpm set-role <provider> <providerId> <admin|user>` MUST đặt `users.role` cho người dùng tương ứng và thoát với mã 1 nếu không tìm thấy. Khi `NODE_ENV = production`, script MUST từ chối `provider = dev` (tài khoản dev đăng nhập chỉ bằng tên) và thoát với mã 1.

#### Scenario: Cấp quyền admin

- **WHEN** chạy `pnpm set-role dev tai admin` với người dùng dev `tai` đã tồn tại
- **THEN** `users.role` của người đó là `admin`

#### Scenario: Tài khoản dev ở production

- **WHEN** chạy `pnpm set-role dev tai admin` với `NODE_ENV = production`
- **THEN** script thoát với mã 1 và không sửa database
