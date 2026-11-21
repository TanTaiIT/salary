# social-login Specification

## Purpose

Cho người dùng đăng nhập bằng tài khoản Apple hoặc Google để sao lưu và đồng bộ dữ liệu, bằng cách đổi id token của nhà cung cấp lấy cặp token của server.

## Requirements

### Requirement: Đổi id token lấy cặp token

`POST /v1/auth/apple` và `POST /v1/auth/google` MUST không cần access token, nhận `{ idToken, name? }` và trả `{ user: { id, name }, accessToken, refreshToken, expiresIn }` khi id token hợp lệ. Hai route dùng giới hạn tần suất đăng nhập.

#### Scenario: Đăng nhập Google lần đầu

- **WHEN** gửi id token Google hợp lệ có `sub = "g-123"` và `name = "Lan"`
- **THEN** server trả 200 với `user.name = "Lan"` và cặp token có `sub` là id người dùng mới

#### Scenario: Đăng nhập lại

- **WHEN** gửi id token Apple hợp lệ có cùng `sub` với một người dùng đã có
- **THEN** server trả cùng `user.id` như lần trước và không tạo người dùng mới

#### Scenario: Thiếu id token

- **WHEN** gửi body `{}`
- **THEN** server trả 422 với `error.code = "validation_failed"`

### Requirement: Kiểm tra id token

Server MUST chỉ chấp nhận id token có chữ ký hợp lệ theo khóa công khai của nhà cung cấp, `iss` đúng nhà cung cấp (Apple: `https://appleid.apple.com`; Google: `https://accounts.google.com` hoặc `accounts.google.com`), `aud` nằm trong danh sách client id cấu hình cho nhà cung cấp đó, và còn hạn. Token không đạt MUST bị từ chối với 401 `invalid_id_token`.

#### Scenario: Token hết hạn

- **WHEN** gửi id token Google đã quá `exp`
- **THEN** server trả 401 với `error.code = "invalid_id_token"`

#### Scenario: Token cấp cho app khác

- **WHEN** gửi id token Apple có `aud` không nằm trong `APPLE_CLIENT_IDS`
- **THEN** server trả 401 với `error.code = "invalid_id_token"`

#### Scenario: Token của nhà cung cấp kia

- **WHEN** gửi id token Google hợp lệ tới `/v1/auth/apple`
- **THEN** server trả 401 với `error.code = "invalid_id_token"`

#### Scenario: Chữ ký giả

- **WHEN** gửi id token có nội dung đúng nhưng ký bằng khóa không phải của nhà cung cấp
- **THEN** server trả 401 với `error.code = "invalid_id_token"`

### Requirement: Nhà cung cấp chưa cấu hình

Khi danh sách client id của một nhà cung cấp trống, route của nhà cung cấp đó MUST trả 503 với `error.code = "provider_not_configured"` và không gọi ra mạng.

#### Scenario: Chưa cấu hình Apple

- **WHEN** `APPLE_CLIENT_IDS` trống và gọi `POST /v1/auth/apple`
- **THEN** server trả 503 với `error.code = "provider_not_configured"`

### Requirement: Thông tin người dùng lưu lại

Server MUST nhận diện người dùng theo nhà cung cấp và `sub`, và chỉ lưu tên hiển thị cùng mã người dùng của nhà cung cấp; MUST NOT lưu email hay thông tin khác trong id token. Tên lấy từ `name` trong body, nếu không có thì từ claim `name`, nếu không có nữa thì là "Người dùng", và chỉ được đặt khi tạo người dùng.

#### Scenario: Apple không gửi tên

- **WHEN** đăng nhập Apple lần đầu, id token không có `name` và body không có `name`
- **THEN** người dùng mới có `name = "Người dùng"`

#### Scenario: Không lưu email

- **WHEN** đăng nhập Google bằng id token có `email`
- **THEN** document người dùng không có trường email
