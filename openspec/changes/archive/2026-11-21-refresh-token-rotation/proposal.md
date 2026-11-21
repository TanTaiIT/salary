# Proposal

## Why

Refresh token hiện sống 30 ngày và không thu hồi được: token bị lộ vẫn dùng được tới khi hết hạn, và người dùng không đăng xuất thật được. (Lỗ hổng token của tài khoản đã xóa đã được phiên làm việc khác sửa bằng cách tra `users` khi xác thực và khi refresh; change này giữ nguyên bước tra đó.) Đặc tả đã yêu cầu lưu `jti` để thu hồi và xoay vòng; việc này phải xong trước khi có đăng nhập Apple, Google thật.

**Giai đoạn lộ trình:** Nền tảng (điều kiện trước MVP có đăng nhập thật).

## What Changes

- Mỗi refresh token gắn với một phiên lưu trong MongoDB (collection mới `sessions`, khóa là `jti`, tự xóa khi hết hạn).
- `POST /v1/auth/refresh` xoay vòng: phiên cũ bị đánh dấu đã dùng, phiên mới được tạo. **BREAKING** (chỉ với token cấp trước thay đổi này): refresh token cấp trước không còn phiên nên bị từ chối, người dùng phải đăng nhập lại. Chưa có app phát hành nên không ảnh hưởng thật.
- Dùng lại một refresh token đã xoay vòng thì thu hồi mọi phiên của người dùng đó (dấu hiệu token bị lộ).
- Xóa tài khoản xóa luôn các phiên của người dùng, để không còn phiên mồ côi chờ TTL dọn.
- Route mới `POST /v1/auth/logout` thu hồi phiên của refresh token gửi lên.
- Mọi cách đăng nhập (dev-login, sau này Apple, Google) cấp token qua cùng một chỗ tạo phiên.

## Ngoài phạm vi

- Thu hồi access token ngay lập tức: access token vẫn dùng được tới khi hết hạn (tối đa 15 phút).
- Danh sách thiết bị đang đăng nhập và "đăng xuất mọi thiết bị" chủ động.
- Khoảng ân hạn cho hai lệnh refresh gần như đồng thời từ cùng một máy: app phải gọi refresh tuần tự.

## Ảnh hưởng đến app

- Sau mỗi lần refresh, app MUST lưu refresh token mới vào SecureStore và bỏ token cũ.
- App gọi refresh tuần tự (một lệnh tại một thời điểm); gọi song song cùng một token sẽ bị coi là dùng lại và bị đăng xuất.
- Màn Cài đặt gọi `POST /v1/auth/logout` khi người dùng đăng xuất.
- Không đổi `src/payroll`; `src/schemas` có thêm `LogoutRequest`, cần chép lại.

## Capabilities

### New Capabilities

_Không có._

### Modified Capabilities

- `auth`: refresh xoay vòng và thu hồi, đăng xuất, phiên theo tài khoản.

## Impact

- Code: `src/lib/auth.ts` (verify trả cả `jti`), dịch vụ phiên mới trong `src/services/`, `src/routes/auth.ts`, `src/db/client.ts` (collection `sessions` + index TTL), `src/schemas`.
- `src/routes/me.ts`: `DELETE /v1/me` xóa thêm collection `sessions`.
- `src/app.ts`: chỉ đổi chỗ gọi `auth.verify`, giữ nguyên bước tra `users` của phiên trước.
- Tài liệu: README (API), `docs/spec.md` (mô hình dữ liệu có thêm `sessions`, bảng API có thêm logout).
