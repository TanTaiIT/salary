# Spec Delta

## ADDED Requirements

### Requirement: Schema cài đặt người dùng

`UserSettingsInput` MUST nhận `deductRate` (số từ 0 đến 100, bước 0,1) và `updatedAt` (ISO 8601). `SyncRequest` MUST nhận thêm `settings` theo schema này, không bắt buộc, để gói kiểu cũ vẫn hợp lệ.

#### Scenario: Tỉ lệ hợp lệ

- **WHEN** kiểm tra `deductRate` là 0; 3,3; 9,4; 100
- **THEN** cả bốn đều hợp lệ

#### Scenario: Tỉ lệ sai

- **WHEN** kiểm tra `deductRate` là 3,33 hoặc 100,1
- **THEN** schema báo lỗi tại `deductRate`

#### Scenario: Gói đồng bộ kiểu cũ

- **WHEN** gói đồng bộ không có `settings`
- **THEN** gói vẫn hợp lệ
