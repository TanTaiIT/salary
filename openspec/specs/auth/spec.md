# Auth Specification

## Purpose

Xác thực bằng JWT cho API: cấp và kiểm tra access token, refresh token, và đăng nhập dev khi phát triển. Đăng nhập Apple, Google chưa làm.

## Requirements

### Requirement: Cặp token

Server MUST cấp cặp token ký HS256 gồm `accessToken` (mặc định sống 900 giây), `refreshToken` (mặc định sống 2.592.000 giây, tức 30 ngày) và `expiresIn` (số giây sống của access token). Mỗi token MUST có `sub` là userId, `iss` và `aud` bằng `JWT_ISSUER`, `typ` là `access` hoặc `refresh`, và `jti` ngẫu nhiên.

#### Scenario: Cấp token sau khi đăng nhập

- **WHEN** người dùng đăng nhập thành công
- **THEN** phản hồi có `accessToken`, `refreshToken` và `expiresIn = 900`

### Requirement: Route cần đăng nhập

Route MUST mặc định yêu cầu header `Authorization: Bearer <accessToken>`; chỉ route khai báo rõ `auth: false` mới không cần. userId dùng trong handler MUST lấy từ token, và người dùng đó MUST còn tồn tại trong `users`.

#### Scenario: Thiếu token

- **WHEN** gọi `GET /v1/work-days?month=2026-11` không có header `Authorization`
- **THEN** server trả 401 với `error.code = "unauthorized"`

#### Scenario: Token sai hoặc hết hạn

- **WHEN** gọi `GET /v1/jobs` với `Authorization: Bearer abc.def.ghi`
- **THEN** server trả 401 với `error.code = "invalid_token"`

#### Scenario: Tài khoản đã xóa

- **WHEN** gọi route cần đăng nhập bằng access token còn hạn của người dùng đã gọi `DELETE /v1/me`
- **THEN** server trả 401 với `error.code = "invalid_token"` và không ghi dữ liệu nào

#### Scenario: Dùng refresh token thay access token

- **WHEN** gọi route cần đăng nhập bằng refresh token
- **THEN** server trả 401 với `error.code = "invalid_token"`

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

### Requirement: Đăng nhập dev

`POST /v1/auth/dev-login` MUST chỉ tồn tại khi `NODE_ENV` khác `production`. Route nhận `{ name }` (1 đến 60 ký tự), tạo người dùng `provider = "dev"`, `providerId = name` nếu chưa có, và trả `{ user: { id, name }, accessToken, refreshToken, expiresIn }`.

#### Scenario: Đăng nhập lại cùng tên

- **WHEN** gọi dev-login hai lần với cùng `name`
- **THEN** cả hai lần trả cùng `user.id`

#### Scenario: Ở production

- **WHEN** gọi `POST /v1/auth/dev-login` khi `NODE_ENV = production`
- **THEN** server trả 404 với `error.code = "not_found"`

### Requirement: Hồ sơ người dùng mới

Khi tạo người dùng mới qua bất kỳ cách đăng nhập nào, server MUST lưu `role = "user"` và `firstSeenAt` bằng thời điểm tạo. Server MUST NOT cho phép client tự đặt `role`. Người dùng tạo trước thay đổi này, chưa có `role`, được coi là `role = "user"`.

#### Scenario: Đăng nhập dev lần đầu

- **WHEN** gọi dev-login với một tên chưa có
- **THEN** người dùng mới có `role = "user"` và `firstSeenAt` là thời điểm tạo

#### Scenario: Client cố gửi role

- **WHEN** gọi dev-login với body `{ name: "a", role: "admin" }`
- **THEN** người dùng được tạo vẫn có `role = "user"`

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
