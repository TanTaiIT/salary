# Spec Delta

## ADDED Requirements

### Requirement: Đồng bộ cài đặt

`POST /v1/sync` MUST nhận `settings` (không bắt buộc) và ghi theo cùng luật với `PUT /v1/me/settings`. Phản hồi MUST luôn có `settings` (bản đang có trên server, hoặc null) và `settingsResult` (`applied`, `stale`, hoặc null khi gói không gửi `settings`).

#### Scenario: Hai máy sửa mức khấu trừ

- **WHEN** máy A đồng bộ `settings` sửa lúc 10:00 với `deductRate = 3.3`, sau đó máy B đồng bộ `settings` sửa lúc 08:00 với `deductRate = 9.4`
- **THEN** máy A nhận `settingsResult = "applied"`
- **AND** máy B nhận `settingsResult = "stale"` cùng `settings.deductRate = 3.3`

#### Scenario: Gói không có cài đặt

- **WHEN** người dùng đã có cài đặt và đồng bộ một gói không có `settings`
- **THEN** phản hồi có `settingsResult = null` và `settings` là bản đang có

#### Scenario: Thiếu token

- **WHEN** gọi `POST /v1/sync` không có token
- **THEN** server trả 401 với `error.code = "unauthorized"`
