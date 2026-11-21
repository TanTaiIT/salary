# Spec Delta

## ADDED Requirements

### Requirement: Hồ sơ người dùng mới

Khi tạo người dùng mới qua bất kỳ cách đăng nhập nào, server MUST lưu `role = "user"` và `firstSeenAt` bằng thời điểm tạo. Server MUST NOT cho phép client tự đặt `role`. Người dùng tạo trước thay đổi này, chưa có `role`, được coi là `role = "user"`.

#### Scenario: Đăng nhập dev lần đầu

- **WHEN** gọi dev-login với một tên chưa có
- **THEN** người dùng mới có `role = "user"` và `firstSeenAt` là thời điểm tạo

#### Scenario: Client cố gửi role

- **WHEN** gọi dev-login với body `{ name: "a", role: "admin" }`
- **THEN** người dùng được tạo vẫn có `role = "user"`
