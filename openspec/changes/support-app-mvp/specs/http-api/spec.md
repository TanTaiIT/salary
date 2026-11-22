# Spec Delta

## ADDED Requirements

### Requirement: CORS cho bản web của app

Server MUST đọc danh sách origin được phép từ `CORS_ORIGINS` (phân cách bằng dấu phẩy, `*` là mọi origin, trống là tắt). Với request có `Origin` được phép, mọi phản hồi, kể cả phản hồi lỗi, MUST có `access-control-allow-origin` bằng origin đó và `access-control-expose-headers: x-request-id`. Server MUST NOT gửi `access-control-allow-credentials`.

#### Scenario: Lỗi vẫn đọc được từ trình duyệt

- **WHEN** `CORS_ORIGINS = http://localhost:8081` và bản web gọi `GET /v1/jobs` không có token
- **THEN** server trả 401 với `error.code = "unauthorized"` và `access-control-allow-origin: http://localhost:8081`

#### Scenario: Mặc định tắt

- **WHEN** `CORS_ORIGINS` trống
- **THEN** không phản hồi nào có `access-control-allow-origin`

### Requirement: Preflight CORS

Preflight `OPTIONS` từ origin được phép MUST trả 204 với `access-control-allow-methods`, `access-control-allow-headers` (gồm `authorization`, `content-type`, `x-request-id`) và `access-control-max-age`. `OPTIONS` từ origin không được phép MUST được xử lý như trước.

#### Scenario: Preflight từ bản web

- **WHEN** trình duyệt gửi `OPTIONS /v1/sync` với `Origin: http://localhost:8081` đã được phép
- **THEN** server trả 204 với `access-control-allow-origin: http://localhost:8081`

#### Scenario: Origin không được phép

- **WHEN** gửi `OPTIONS /v1/sync` với `Origin: https://evil.example`
- **THEN** phản hồi không có `access-control-allow-origin`
- **AND** server trả 405 với `error.code = "method_not_allowed"`
