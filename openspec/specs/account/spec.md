# Account Specification

## Purpose

Tài khoản của người dùng: xóa tài khoản cùng toàn bộ dữ liệu, theo yêu cầu của Apple với app có tạo tài khoản.

## Requirements

### Requirement: Xóa tài khoản

`DELETE /v1/me` MUST xóa hẳn (không xóa mềm) mọi `workDays`, `weeklyHolidayPays`, `jobs`, `sessions` của người dùng trong token, rồi xóa bản ghi `users`, tất cả trong một transaction, và trả 204. Dữ liệu của người dùng khác MUST NOT bị ảnh hưởng.

#### Scenario: Xóa thành công

- **WHEN** `user-1` gọi `DELETE /v1/me`
- **THEN** server trả 204 và không còn bản ghi nào có `userId = user-1` hay `users._id = user-1`
- **AND** dữ liệu của người dùng khác vẫn còn

#### Scenario: Lỗi giữa chừng

- **WHEN** một bước xóa thất bại sau khi đã xóa một phần dữ liệu
- **THEN** transaction hoàn tác, mọi dữ liệu của người dùng vẫn còn nguyên và người dùng gọi lại được

#### Scenario: Thiếu token

- **WHEN** gọi `DELETE /v1/me` không có token
- **THEN** server trả 401 với `error.code = "unauthorized"`

### Requirement: Thông tin tài khoản

`GET /v1/me` MUST trả `{ id, name, provider, role, firstOpenAt, settings }` của người dùng trong token. `role` là `"user"` hoặc `"admin"` (bản ghi thiếu trường này coi là `"user"`); app chỉ dùng nó để hiện trang quản trị, còn quyền thật MUST vẫn được kiểm tra ở từng route admin.

#### Scenario: Người dùng thường

- **WHEN** người dùng không có `users.role` gọi `GET /v1/me`
- **THEN** server trả 200 với `role = "user"`
