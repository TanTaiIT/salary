# Design

## Context

Xem proposal.md (Why). `createAuth` trong `src/lib/auth.ts` ký JWT HS256 có `jti` ngẫu nhiên nhưng không lưu ở đâu. `verify` chỉ trả `sub`. `dev-login` và `refresh` gọi thẳng `deps.auth.issue(userId)`.

## Goals / Non-Goals

**Goals:**
- Thu hồi được từng phiên và toàn bộ phiên của một người dùng.
- Phát hiện refresh token bị dùng lại mà không cần lưu lịch sử vô hạn.
- `src/lib/auth.ts` vẫn thuần (chỉ ký và kiểm tra JWT), không chạm MongoDB.

**Non-Goals:**
- Danh sách thiết bị, tên thiết bị, IP của phiên.

## Decisions

### Collection `sessions`

`{ _id: jti, userId, createdAt, expiresAt, rotatedAt: Date | null }`. Index TTL trên `expiresAt` (`expireAfterSeconds: 0`) để MongoDB tự dọn phiên hết hạn, và index `userId` để thu hồi theo người dùng.

*Phương án khác:* lưu danh sách `jti` trong `users`. Bỏ vì document người dùng sẽ phình theo số lần refresh, và cập nhật đồng thời dễ xung đột.

### Dịch vụ phiên `src/services/sessions.ts`

- `issueSession(deps, userId)`: gọi `auth.issue`, rồi ghi phiên với `jti` của refresh token và `expiresAt = now + refreshTtl`. Trả đúng `{ accessToken, refreshToken, expiresIn }` như trước.
- `rotateSession(deps, refreshToken)`:
  1. `auth.verify(token, 'refresh')` trả `{ userId, jti }`, sai thì 401.
  2. Người dùng không còn thì 401.
  3. `findOneAndUpdate({ _id: jti, userId, rotatedAt: null }, { $set: { rotatedAt: now } })`. Lệnh nguyên tử này bảo đảm hai lệnh song song chỉ một lệnh thắng.
  4. Không có kết quả: nếu phiên tồn tại với `rotatedAt` khác null thì đây là dùng lại, chạy `deleteMany({ userId })`, ghi log cảnh báo và trả 401; nếu không có phiên thì trả 401.
  5. Có kết quả thì gọi `issueSession`.
- `revokeSession(deps, refreshToken)`: verify, lỗi thì bỏ qua; xóa phiên theo `jti`.
- `revokeAllSessions(cols, userId)`: dùng cho `DELETE /v1/me`.

Phiên đã xoay vòng được giữ tới `expiresAt` (TTL dọn), nên vẫn phát hiện dùng lại trong suốt thời gian token còn hạn.

### Đổi `Auth.verify`

`verify(token, type)` trả `{ userId, jti }` thay cho chuỗi userId. `app.ts` đổi theo (`(await verify(...)).userId`). Kiểu dữ liệu đổi nên `tsc` bắt được mọi chỗ gọi sót.

### Mã lỗi

Mọi trường hợp refresh thất bại đều trả 401 `invalid_token`, để không lộ cho kẻ gian biết token bị phát hiện dùng lại. Lý do thật chỉ ghi trong log.

## Risks / Trade-offs

- [App gọi refresh song song bằng cùng một token, ví dụ hai request cùng gặp 401] → Lệnh thua bị coi là dùng lại và người dùng bị đăng xuất. App phải gom refresh thành một lệnh duy nhất; đã ghi trong "Ảnh hưởng đến app".
- [Thêm một truy vấn `users` và một lệnh ghi cho mỗi lần refresh] → Refresh hiếm (15 phút một lần), không đáng kể.
- [Đồng hồ server khác MongoDB khi tính TTL] → TTL chỉ dùng để dọn dẹp; JWT `exp` vẫn là nơi quyết định hết hạn.

## Migration Plan

Khi triển khai, mọi refresh token cũ bị từ chối và người dùng đăng nhập lại; chưa có người dùng thật. Muốn quay lại bản cũ thì gỡ code; collection `sessions` để lại cũng không hại gì.
