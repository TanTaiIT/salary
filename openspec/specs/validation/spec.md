# Validation Specification

## Purpose

Schema zod trong `src/schemas/` kiểm tra dữ liệu app gửi lên. Thư mục này được chép sang app React Native để app kiểm tra dữ liệu bằng đúng luật của server trước khi lưu và đồng bộ.

## Requirements

### Requirement: Dữ liệu một ngày công

Hệ thống MUST chấp nhận một ngày công chỉ khi: `jobId` là chuỗi 1 đến 64 ký tự; `date` là ngày hợp lệ dạng `"YYYY-MM-DD"`; mỗi loại giờ trong `hours` (x1, x1_5, x2, x2_5, x3) là bội số của 0,5 trong khoảng 0 đến 24; tổng giờ không quá 24; `allowance` là số nguyên won từ 0 đến 100.000.000; `wageSnapshot` là số nguyên won từ 1 đến 1.000.000; `note` (không bắt buộc, mặc định chuỗi rỗng) là chuỗi đã bỏ khoảng trắng hai đầu, tối đa 200 ký tự; `updatedAt` là thời điểm ISO 8601.

#### Scenario: Ghi chú

- **WHEN** gửi ngày công không có `note`, hoặc có `note = "  Ca đêm  "`
- **THEN** dữ liệu hợp lệ với `note` lần lượt là `""` và `"Ca đêm"`; `note` dài 201 ký tự bị từ chối tại đường dẫn `note`

#### Scenario: Giờ lẻ không phải bội số 0,5

- **WHEN** gửi ngày công có `hours.x1 = 7.3`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `hours.x1`

#### Scenario: Tổng giờ quá 24

- **WHEN** gửi ngày công có 16 giờ x1 và 10 giờ x1_5
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `hours` và thông báo tổng số giờ không được quá 24

#### Scenario: Ngày không có thật

- **WHEN** gửi ngày công có `date = "2026-02-30"`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `date`

### Requirement: Định danh và tháng

Hệ thống MUST yêu cầu id ngày công là UUID và tham số tháng có dạng `"YYYY-MM"` với tháng từ 01 đến 12.

#### Scenario: Tháng sai dạng

- **WHEN** gửi tháng `"2026-13"`
- **THEN** dữ liệu bị từ chối với thông báo tháng phải có dạng YYYY-MM

### Requirement: Không phụ thuộc server

Mã trong `src/schemas/` MUST chỉ import `zod` và `src/payroll/`, không import module riêng của Node hay code server khác.

#### Scenario: Chép sang app

- **WHEN** chép `src/schemas/` cùng `src/payroll/` sang app React Native đã cài zod
- **THEN** các schema chạy được mà không cần thêm thư viện nào khác

### Requirement: Dữ liệu nơi làm việc

Hệ thống MUST chấp nhận dữ liệu nơi làm việc chỉ khi: `name` dài 1 đến 60 ký tự sau khi bỏ khoảng trắng hai đầu; `hourlyWage` là số nguyên won từ 1 đến 1.000.000; `companySize` là `under5` hoặc `5plus`; và, khi đồng bộ, `updatedAt` là thời điểm ISO 8601.

#### Scenario: Tên chỉ có khoảng trắng

- **WHEN** gửi nơi làm việc có `name = "   "`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `name`

#### Scenario: Quy mô công ty không hợp lệ

- **WHEN** gửi `companySize = "big"`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `companySize`

### Requirement: Dữ liệu 주휴수당

Hệ thống MUST chấp nhận một khoản 주휴수당 chỉ khi: `jobId` là chuỗi 1 đến 64 ký tự; `weekStart` là ngày hợp lệ dạng `"YYYY-MM-DD"` và là thứ Hai; `amount` là số nguyên won từ 0 đến 100.000.000; `updatedAt` là thời điểm ISO 8601.

#### Scenario: Tuần không bắt đầu từ thứ Hai

- **WHEN** gửi `weekStart = "2026-11-22"` (Chủ nhật)
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `weekStart`

#### Scenario: Số tiền lẻ

- **WHEN** gửi `amount = 30960.5`
- **THEN** dữ liệu bị từ chối với lỗi tại đường dẫn `amount`
