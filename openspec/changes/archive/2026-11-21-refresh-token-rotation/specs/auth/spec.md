# Spec Delta

## MODIFIED Requirements

### Requirement: Làm mới token

`POST /v1/auth/refresh` MUST không cần access token, nhận `{ refreshToken }` và trả cặp token mới cho đúng userId của refresh token, chỉ khi phiên của token đó còn hiệu lực và người dùng đó còn tồn tại. Mỗi lần thành công, phiên cũ MUST bị đánh dấu đã dùng và một phiên mới được tạo cho refresh token mới. Route này dùng giới hạn tần suất đăng nhập.

#### Scenario: Refresh sau khi xóa tài khoản

- **WHEN** gửi refresh token còn hạn của người dùng đã xóa tài khoản
- **THEN** server trả 401 với `error.code = "invalid_token"`

#### Scenario: Refresh hợp lệ

- **WHEN** gửi refresh token còn hạn của `user-1`
- **THEN** server trả 200 với cặp token mới có `sub = user-1`

#### Scenario: Dùng access token để refresh

- **WHEN** gửi access token vào trường `refreshToken`
- **THEN** server trả 401 với `error.code = "invalid_token"`

#### Scenario: Token cũ không dùng được sau khi xoay vòng

- **WHEN** refresh thành công bằng token A, sau đó gửi lại token A
- **THEN** lần gửi lại trả 401 với `error.code = "invalid_token"`

#### Scenario: Token cấp trước khi có phiên

- **WHEN** gửi refresh token hợp lệ về chữ ký nhưng không có phiên tương ứng
- **THEN** server trả 401 với `error.code = "invalid_token"`

## ADDED Requirements

### Requirement: Thu hồi khi refresh token bị dùng lại

Khi một refresh token đã xoay vòng được gửi lại, server MUST thu hồi mọi phiên của người dùng đó và trả 401, vì đây là dấu hiệu token bị lộ.

#### Scenario: Kẻ gian dùng token đã lộ

- **WHEN** app đã refresh bằng token A và nhận token B, sau đó có người gửi lại token A
- **THEN** server trả 401 với `error.code = "invalid_token"`
- **AND** token B cũng bị từ chối ở lần refresh tiếp theo

### Requirement: Đăng xuất

`POST /v1/auth/logout` MUST không cần access token, nhận `{ refreshToken }`, thu hồi phiên của token đó và trả 204. Route MUST trả 204 cả khi token không hợp lệ hoặc phiên đã bị thu hồi, để app đăng xuất được kể cả khi token đã hỏng. Route dùng giới hạn tần suất đăng nhập.

#### Scenario: Đăng xuất thành công

- **WHEN** gửi refresh token còn hiệu lực tới `/v1/auth/logout`
- **THEN** server trả 204
- **AND** refresh bằng token đó sau đó trả 401 với `error.code = "invalid_token"`

#### Scenario: Đăng xuất bằng token hỏng

- **WHEN** gửi `refreshToken = "xxxxxxxxxxxx"`
- **THEN** server trả 204

#### Scenario: Thiếu refresh token

- **WHEN** gửi body `{}`
- **THEN** server trả 422 với `error.code = "validation_failed"`

### Requirement: Phiên theo tài khoản

Mỗi cặp token cấp ra MUST gắn với một phiên lưu trên server, hết hạn cùng refresh token. Khi xóa tài khoản, server MUST xóa mọi phiên của người dùng đó.

#### Scenario: Đăng nhập trên hai máy

- **WHEN** người dùng đăng nhập trên máy A và máy B rồi đăng xuất trên máy A
- **THEN** refresh token của máy B vẫn dùng được

#### Scenario: Xóa tài khoản

- **WHEN** người dùng gọi `DELETE /v1/me` thành công
- **THEN** mọi refresh token của người dùng đó bị từ chối với `error.code = "invalid_token"`
