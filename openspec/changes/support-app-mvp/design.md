# Design

## Context

Xem proposal.md. App đang tính thống kê trong `src/app/stats.tsx` và khấu trừ trong `src/data/deduction.ts` của repo app. Cài đặt lưu trong bảng `kv` của SQLite trên máy. Server chưa có `GET /v1/me`, chưa có CORS.

## Goals / Non-Goals

**Goals:**
- Mọi con số trên màn Thống kê và lương thực nhận tính bằng `src/payroll`, giống nhau ở app và server.
- Mức khấu trừ theo người dùng sang được máy khác, cùng luật xung đột với dữ liệu khác.
- Bản web của app gọi được API khi dev.

**Non-Goals:**
- Đổi cách tính `workPay` hiện có.
- Cấu hình CORS theo từng route.

## Decisions

### `payByType` bỏ phần lẻ theo loại, không theo ngày

`workPay` bỏ phần lẻ theo từng ngày (luật hiện có). `payByType[k]` cộng `round(h×2) × round(m×2) × w` của mọi ngày rồi chia 4 và bỏ phần lẻ một lần. Lý do: con số này là "tiền của loại giờ x1,5 trong tháng", bỏ lẻ một lần là đúng nhất. Tổng các loại có thể lệch `workPay` vài won. Ghi rõ trong comment, và màn hình không hiển thị tổng của `payByType`.

### `weeklyTotals`

Đoạn tuần bắt đầu thứ Hai, cắt ở ngày 1 và ngày cuối tháng (tháng 11/2026 có 6 đoạn, đoạn đầu chỉ có CN 1/11). Mỗi đoạn cộng `dayPay(d).total` của ngày trong đoạn và `amount` của các khoản 주휴수당 có CN (`weekStart + 6`) nằm trong đoạn. Ngày ngoài tháng bị bỏ qua để hàm nhận được danh sách chưa lọc.

### `deductionAmount`

`floor(total × round(rate × 10) / 1000)`, tức tính theo phần nghìn. Phép `total × 0,033` trực tiếp có thể ra 32.999,999… với dấu phẩy động. Tỉ lệ âm, 0 hay tổng ≤ 0 trả 0; tỉ lệ trên 100 bị chặn ở 100.

### Cài đặt trong `users.settings`

`settings: { deductRate, updatedAt }` nhúng trong `users`, không tạo collection mới: mỗi người một bản, đọc theo `_id`, và `DELETE /v1/me` xóa luôn mà không phải sửa gì.

Ghi bằng một lệnh có điều kiện để hai máy ghi cùng lúc không đè nhầm:

```js
updateOne({ _id: userId, 'settings.updatedAt': { $not: { $gte: incoming } } }, { $set: { settings } })
```

`$not $gte` khớp cả khi chưa có `settings`. `matchedCount = 0` nghĩa là bản server mới hơn hoặc bằng, nên trả `stale` cùng bản hiện có. Luật bằng nhau thì giữ bản server, giống ngày công.

Chỉ đồng bộ `deductRate`. Chế độ màu và nơi làm đang chọn là lựa chọn của từng máy.

### `/v1/sync` và `/v1/me`

- Sync xử lý `settings` sau `firstOpenAt`, rồi đọc `users` một lần lấy cả `firstSeenAt` và `settings`. Phản hồi luôn có `settings` (null nếu chưa có), và `settingsResult` là `applied`, `stale`, hoặc null khi gói không gửi `settings`. Không dùng `serverUpdatedAt` cho cài đặt: bản ghi rất nhỏ nên trả mỗi lần cho đơn giản.
- `PUT /v1/me/settings` khi stale trả 409 `stale_update` với `details` là bản server, giống `PUT /v1/work-days/:id`.

### CORS

`CORS_ORIGINS` là danh sách phân cách bằng dấu phẩy, `*` là mọi origin, trống là tắt (mặc định).
- Header đặt ngay đầu `handle()`, trước rate limit, để cả phản hồi 429, 401 cũng đọc được từ trình duyệt.
- Preflight `OPTIONS` từ origin được phép trả 204 với `allow-methods`, `allow-headers` (`authorization`, `content-type`, `x-request-id`) và `max-age` 600. Origin không được phép thì đi tiếp như cũ và nhận 405.
- Không bật `allow-credentials`, vì token đi qua header, không dùng cookie.
- Không dùng thư viện: chỉ vài header, `node:http` tự làm được.

## Risks / Trade-offs

- [`CORS_ORIGINS=*` ở production cho phép mọi trang gọi API] → Vẫn cần access token của người dùng, không có cookie nên không có CSRF. README khuyên liệt kê origin cụ thể.
- [Giờ máy sai làm bản cũ thắng] → Cùng rủi ro đã chấp nhận với ngày công ở MVP.
