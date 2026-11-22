# Spec Delta

## MODIFIED Requirements

### Requirement: Tổng lương tháng

Hệ thống MUST tổng hợp một tháng gồm: `workPay` (tổng tiền công các ngày), `allowance` (tổng trợ cấp), `weeklyHolidayPay` (tổng các khoản 주휴수당 được truyền vào), `total` (tổng ba khoản trên), `baseHours` (giờ x1), `overtimeHours` (tổng giờ x1_5, x2, x2_5, x3), `hoursByType`, `payByType` và `workDays` (số ngày có ít nhất một giờ làm). `payByType[k]` MUST là `floor(Σ h_k × m_k × w)` của mọi ngày trong tháng, với `w` là lương giờ của từng ngày, và chỉ bỏ phần lẻ một lần cho mỗi loại giờ.

#### Scenario: Ngày chỉ có trợ cấp không tính là ngày làm

- **WHEN** tháng có một ngày 8 giờ x1 và một ngày 0 giờ nhưng có trợ cấp 10.000 ₩
- **THEN** `workDays` là 1
- **AND** trợ cấp 10.000 ₩ vẫn được cộng vào `allowance` và `total`

#### Scenario: Cộng 주휴수당 vào tổng tháng

- **WHEN** tổng tiền công là 1.000.000 ₩, trợ cấp 50.000 ₩, một khoản 주휴수당 30.960 ₩
- **THEN** `total` là 1.080.960 ₩

#### Scenario: Tiền theo loại giờ

- **WHEN** tháng có một ngày 6 giờ x1 và 2 giờ x1_5, một ngày 8 giờ x1, lương giờ 10.320 ₩
- **THEN** `payByType.x1` là 144.480 ₩ và `payByType.x1_5` là 30.960 ₩

#### Scenario: Tiền theo loại giờ bỏ phần lẻ một lần

- **WHEN** tháng có hai ngày, mỗi ngày 0,5 giờ x1_5, lương giờ 10.001 ₩
- **THEN** `payByType.x1_5` là 15.001 ₩ (15.001,5 bị bỏ phần lẻ)
- **AND** `workPay` vẫn là 15.000 ₩ (mỗi ngày 7.500 ₩)

## ADDED Requirements

### Requirement: Lương theo tuần trong tháng

Hệ thống MUST chia một tháng thành các đoạn tuần bắt đầu từ thứ Hai, cắt ở ngày đầu và ngày cuối tháng. Mỗi đoạn có `from`, `to` và `total`. `total` gồm tổng `dayPay().total` của các ngày công trong đoạn, cộng `amount` của các khoản 주휴수당 có ngày Chủ nhật (`weekStart + 6`) nằm trong đoạn. Ngày công và 주휴수당 ngoài tháng MUST bị bỏ qua.

#### Scenario: Các đoạn tuần của tháng 11/2026

- **WHEN** chia tháng `2026-11`
- **THEN** có 6 đoạn: 01–01, 02–08, 09–15, 16–22, 23–29, 30–30

#### Scenario: Cộng tiền vào đúng đoạn

- **WHEN** ngày 16/11 có 8 giờ x1, ngày 17/11 có 6 giờ x1, 2 giờ x1_5 và trợ cấp 10.000 ₩, lương giờ 10.320 ₩, cùng khoản 주휴수당 30.960 ₩ của tuần `2026-11-16`
- **THEN** đoạn 16–22 có `total` là 216.400 ₩ (82.560 + 102.880 + 30.960)

#### Scenario: 주휴수당 của tuần vắt qua tháng trước

- **WHEN** có khoản 41.280 ₩ của tuần `2026-10-26` (Chủ nhật là 01/11)
- **THEN** khoản đó nằm trong đoạn 01–01 của tháng 11

### Requirement: Trung bình mỗi ngày làm

Hệ thống MUST tính trung bình mỗi ngày làm bằng `floor((workPay + allowance) ÷ workDays)`, không tính 주휴수당, và trả 0 khi `workDays = 0`.

#### Scenario: Ba ngày làm có 주휴수당

- **WHEN** tháng có ba ngày công 82.560 ₩, 102.880 ₩, 82.560 ₩ và một khoản 주휴수당 30.960 ₩
- **THEN** trung bình mỗi ngày là 89.333 ₩

#### Scenario: Chưa có ngày làm

- **WHEN** tháng không có ngày công nào
- **THEN** trung bình mỗi ngày là 0 ₩

### Requirement: Khấu trừ ước tính

Hệ thống MUST tính tiền khấu trừ ước tính bằng `floor(total × round(rate × 10) ÷ 1000)`, với `rate` là phần trăm người dùng chọn. Tỉ lệ ≤ 0 hoặc tổng ≤ 0 MUST trả 0; tỉ lệ trên 100 tính như 100.

#### Scenario: Thuế 3,3%

- **WHEN** tổng lương 2.345.678 ₩, tỉ lệ 3,3
- **THEN** khấu trừ là 77.407 ₩

#### Scenario: Không sai số dấu phẩy động

- **WHEN** tổng lương 1.000.000 ₩, tỉ lệ 3,3
- **THEN** khấu trừ là đúng 33.000 ₩

#### Scenario: Không khấu trừ

- **WHEN** tỉ lệ là 0
- **THEN** khấu trừ là 0 ₩
