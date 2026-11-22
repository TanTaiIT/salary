# Spec Delta

## ADDED Requirements

### Requirement: Xem tài khoản

`GET /v1/me` MUST trả `{ id, name, provider, firstOpenAt, settings }` của người dùng trong token. `firstOpenAt` là `firstSeenAt` (hoặc `createdAt` nếu chưa có). `settings` là `{ deductRate, updatedAt }`, hoặc null nếu người dùng chưa đổi cài đặt lần nào.

#### Scenario: Người dùng chưa đổi cài đặt

- **WHEN** người dùng có `firstSeenAt = 2026-03-01` gọi `GET /v1/me`
- **THEN** server trả 200 với `firstOpenAt = 2026-03-01T00:00:00.000Z` và `settings = null`

#### Scenario: Thiếu token

- **WHEN** gọi `GET /v1/me` không có token
- **THEN** server trả 401 với `error.code = "unauthorized"`

### Requirement: Sửa cài đặt

`PUT /v1/me/settings` MUST nhận `UserSettingsInput` và ghi vào `users.settings` theo nguyên tắc bản sửa mới nhất thắng: nếu bản trên server có `updatedAt` mới hơn hoặc bằng thì giữ bản server. Ghi thành công trả 200 với cài đặt vừa ghi.

#### Scenario: Ghi thành công

- **WHEN** người dùng gửi `{ deductRate: 3.3, updatedAt: "2026-11-20T10:00:00Z" }`
- **THEN** server trả 200 với đúng cài đặt đó
- **AND** `GET /v1/me` trả `settings.deductRate = 3.3`

#### Scenario: Bản cũ hơn

- **WHEN** server đang có cài đặt sửa lúc 10:00 và người dùng gửi bản sửa lúc 09:00
- **THEN** server trả 409 với `error.code = "stale_update"` và `details` là bản đang có trên server

#### Scenario: Tỉ lệ sai

- **WHEN** gửi `deductRate = 3.33`
- **THEN** server trả 422 với `error.code = "validation_failed"` và `details` có `path = "deductRate"`
