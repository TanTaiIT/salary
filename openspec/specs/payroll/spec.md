# Payroll Specification

## Purpose

Lõi tính lương thuần TypeScript trong `src/payroll/`: tiền công một ngày, lương ngày nghỉ tuần (주휴수당), tổng lương tháng và các phép tính ngày. Thư mục này được chép nguyên sang app React Native, nên app và server luôn ra cùng một con số với cùng dữ liệu đầu vào.

## Requirements

### Requirement: Tiền công một ngày

Hệ thống MUST tính tiền công một ngày bằng `floor(Σ h_k × m_k × w)` cộng tiền trợ cấp, với hệ số x1 = 1, x1_5 = 1,5, x2 = 2, x2_5 = 2,5, x3 = 3, và `w` là lương giờ lưu cùng ngày công (`wageSnapshot`). Kết quả gồm `work` (tiền theo giờ), `allowance` và `total = work + allowance`.

#### Scenario: Giờ cơ bản cộng tăng ca và trợ cấp

- **WHEN** ngày công có 8 giờ x1, 2 giờ x1_5, lương giờ 10.320 ₩, trợ cấp 5.000 ₩
- **THEN** `work` là 113.520 ₩ (82.560 + 30.960)
- **AND** `total` là 118.520 ₩

#### Scenario: Bỏ phần lẻ dưới 1 won

- **WHEN** ngày công có 0,5 giờ x1_5, lương giờ 10.001 ₩, không có trợ cấp
- **THEN** `work` là 7.500 ₩ (7.500,75 bị bỏ phần lẻ)

#### Scenario: Chỉ bỏ phần lẻ một lần ở bước cuối

- **WHEN** ngày công có 0,5 giờ x1_5 và 0,5 giờ x2_5, lương giờ 10.001 ₩
- **THEN** `work` là 20.002 ₩ (tổng 20.002 rồi mới bỏ lẻ), không phải 20.001 ₩ (bỏ lẻ từng loại giờ rồi cộng)

### Requirement: Lương ngày nghỉ tuần (주휴수당)

Hệ thống MUST tính 주휴수당 của một tuần bằng `floor(min(H, maxHours) ÷ maxHours × paidHours × w)` khi tổng giờ cơ bản `H` của tuần đạt ít nhất `minHours`, và trả 0 khi chưa đạt. Quy định mặc định là `minHours = 15`, `maxHours = 40`, `paidHours = 8`; quy định của từng năm lấy từ ruleSets.

#### Scenario: Vừa đủ 15 giờ

- **WHEN** tuần có 15 giờ cơ bản, lương giờ 10.320 ₩
- **THEN** 주휴수당 là 30.960 ₩

#### Scenario: Chưa đủ giờ

- **WHEN** tuần có 14,5 giờ cơ bản
- **THEN** 주휴수당 là 0 ₩

#### Scenario: Quá 40 giờ chỉ trả 8 giờ

- **WHEN** tuần có 50 giờ cơ bản, lương giờ 10.320 ₩
- **THEN** 주휴수당 là 82.560 ₩ (8 × 10.320)

### Requirement: Tổng lương tháng

Hệ thống MUST tổng hợp một tháng gồm: `workPay` (tổng tiền công các ngày), `allowance` (tổng trợ cấp), `weeklyHolidayPay` (tổng các khoản 주휴수당 được truyền vào), `total` (tổng ba khoản trên), `baseHours` (giờ x1), `overtimeHours` (tổng giờ x1_5, x2, x2_5, x3), `hoursByType` và `workDays` (số ngày có ít nhất một giờ làm).

#### Scenario: Ngày chỉ có trợ cấp không tính là ngày làm

- **WHEN** tháng có một ngày 8 giờ x1 và một ngày 0 giờ nhưng có trợ cấp 10.000 ₩
- **THEN** `workDays` là 1
- **AND** trợ cấp 10.000 ₩ vẫn được cộng vào `allowance` và `total`

#### Scenario: Cộng 주휴수당 vào tổng tháng

- **WHEN** tổng tiền công là 1.000.000 ₩, trợ cấp 50.000 ₩, một khoản 주휴수당 30.960 ₩
- **THEN** `total` là 1.080.960 ₩

### Requirement: Ngày là chuỗi theo lịch

Hệ thống MUST biểu diễn ngày công bằng chuỗi `"YYYY-MM-DD"` theo giờ Hàn Quốc, chỉ chấp nhận ngày có thật trên lịch (kể cả năm nhuận), và tính toán ngày không phụ thuộc múi giờ của máy chạy code. Tuần tính từ thứ Hai đến Chủ nhật.

#### Scenario: Năm nhuận

- **WHEN** kiểm tra `2028-02-29` và `2026-02-29`
- **THEN** `2028-02-29` hợp lệ
- **AND** `2026-02-29` không hợp lệ

#### Scenario: Thứ Hai đầu tuần của ngày Chủ nhật

- **WHEN** lấy đầu tuần của `2026-11-22` (Chủ nhật)
- **THEN** kết quả là `2026-11-16`

#### Scenario: Khoảng ngày của tháng

- **WHEN** lấy khoảng ngày của tháng `2028-02`
- **THEN** kết quả là từ `2028-02-01` đến `2028-02-29`

### Requirement: Không phụ thuộc server

Mã trong `src/payroll/` MUST NOT import module riêng của Node (`node:*`), thư viện bên ngoài, hay code khác trong `src/`.

#### Scenario: Chép sang app

- **WHEN** chép thư mục `src/payroll/` sang app React Native
- **THEN** các hàm chạy được mà không cần cài thêm thư viện nào
