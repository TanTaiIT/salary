# App Config Specification

## Purpose

Cấu hình app tải từ server: quảng cáo (bật, tắt, các cấp, giới hạn) và phiên bản app tối thiểu, để đổi ngưỡng quảng cáo mà không cần phát hành bản mới. Hàm chọn cấp `adTier` nằm trong `src/schemas/ads.ts` và được app dùng qua bản chép.

## Requirements

### Requirement: Xem cấu hình

`GET /v1/config` MUST không cần đăng nhập và trả `{ ads, minAppVersion, updatedAt }` từ `appConfig/current`. Khi chưa có bản ghi, server MUST trả cấu hình mặc định `DEFAULT_AD_CONFIG`, `minAppVersion = "0.0.0"` và `updatedAt = null`.

#### Scenario: Chưa nạp cấu hình

- **WHEN** gọi `GET /v1/config` khi `appConfig` rỗng
- **THEN** server trả 200 với `ads.enabled = true` và 3 cấp quảng cáo, trong đó cấp 3 có `enabled = false`

### Requirement: Chọn cấp quảng cáo

`adTier({ daysSinceFirstOpen, activeDays }, config)` MUST trả cấp đang bật cao nhất mà người dùng đạt cả `minDays` và `minActiveDays`, cùng danh sách vị trí cộng dồn của mọi cấp đang bật tới cấp đó. Khi `config.enabled = false` hoặc không đạt cấp nào, kết quả MUST là `{ tier: 0, placements: [] }`.

#### Scenario: Lên cấp 2

- **WHEN** người dùng ở ngày 90 và có 30 ngày chấm công, với cấu hình mặc định
- **THEN** `tier = 2` và `placements` có cả vị trí của cấp 1 và cấp 2

#### Scenario: Thiếu ngày chấm công

- **WHEN** người dùng ở ngày 90 nhưng mới có 29 ngày chấm công
- **THEN** `tier = 1`

#### Scenario: Cấp bị tắt

- **WHEN** người dùng đạt ngưỡng cấp 3 nhưng cấp 3 có `enabled = false`
- **THEN** `tier = 2`

### Requirement: Nạp cấu hình

Script `pnpm seed:config` MUST kiểm tra cấu hình bằng schema `AppConfig` rồi ghi (tạo mới hoặc thay thế) `appConfig/current`.

#### Scenario: Mã vị trí lạ

- **WHEN** cấu hình có vị trí không nằm trong danh sách mã vị trí
- **THEN** script dừng với lỗi kiểm tra dữ liệu và không ghi gì
