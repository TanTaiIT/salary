# Tasks

## 1. Lưu phiên

- [x] 1.1 Thêm `SessionDoc`, collection `sessions`, index TTL `expiresAt` và index `userId` vào `src/db/client.ts`; kiểm tra bằng test tích hợp: sau `ensureIndexes` có đủ hai index
- [x] 1.2 Đổi `Auth.verify` trả `{ userId, jti }` và sửa mọi chỗ gọi; kiểm tra bằng `pnpm typecheck` và test hiện có trong `test/app.test.ts`

## 2. Dịch vụ phiên

- [x] 2.1 Tạo `src/services/sessions.ts` (`issueSession`, `rotateSession`, `revokeSession`, `revokeAllSessions`) theo design; kiểm tra bằng test tích hợp: xoay vòng thành công, token cũ bị từ chối, dùng lại thu hồi cả token mới, người dùng đã xóa bị từ chối, token không có phiên bị từ chối
- [x] 2.2 Cho `dev-login` và `refresh` cấp token qua `issueSession`/`rotateSession`; kiểm tra bằng test tích hợp: dev-login rồi refresh hai lần liên tiếp đều trả 200

## 3. Đăng xuất

- [x] 3.1 Thêm `LogoutRequest` vào `src/schemas` và route `POST /v1/auth/logout` (auth: false, limiter auth, luôn 204 khi body hợp lệ); kiểm tra bằng test tích hợp: đăng xuất rồi refresh trả 401, token hỏng vẫn 204, body `{}` trả 422, đăng xuất máy A không ảnh hưởng máy B

## 4. Xóa tài khoản

- [x] 4.1 Gọi `revokeAllSessions` trong `DELETE /v1/me`; kiểm tra bằng test tích hợp: sau khi xóa tài khoản, collection `sessions` không còn phiên nào của người dùng và refresh trả 401

## 5. Tài liệu và kiểm tra cuối

- [x] 5.1 Cập nhật README (bảng API có logout, bỏ mục "Thu hồi refresh token" khỏi Việc tiếp theo) và `docs/spec.md` (collection `sessions`, route logout); kiểm tra bằng cách đọc lại khớp spec delta
- [x] 5.2 Chạy `pnpm test`, `pnpm typecheck` và `openspec validate refresh-token-rotation --strict`, tất cả đều qua
