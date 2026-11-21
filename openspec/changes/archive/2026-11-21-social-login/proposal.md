# Proposal

## Why

MVP cho phép đăng nhập Apple, Google (không bắt buộc) để sao lưu và dùng trên nhiều máy. Hiện server chỉ có `dev-login`, vốn bị tắt ở production, nên app thật chưa có cách nào lấy token để đồng bộ.

**Giai đoạn lộ trình:** MVP.

## What Changes

- Route mới `POST /v1/auth/apple` và `POST /v1/auth/google`: nhận id token app lấy từ SDK của nhà cung cấp, kiểm tra chữ ký bằng khóa công khai của nhà cung cấp, kiểm tra `iss`, `aud`, `exp`, rồi trả cặp token của server như `dev-login`.
- Người dùng được nhận diện theo `provider + sub` của id token. Lần đầu sẽ tạo người dùng mới (`role = "user"`, `firstSeenAt`).
- Tên hiển thị lấy theo thứ tự: `name` app gửi lên, claim `name` trong id token, rồi "Người dùng". Chỉ lưu khi tạo người dùng. Không lưu email.
- Biến môi trường mới `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_IDS` (danh sách phân cách bằng dấu phẩy). Nếu biến của một nhà cung cấp để trống thì route đó trả 503.

## Ngoài phạm vi

- Đăng nhập Kakao (giai đoạn 4).
- Kiểm tra `nonce` chống phát lại id token. Id token sống ngắn (Apple khoảng 10 phút, Google 1 giờ) và gắn với `aud` của app; nonce có thể thêm sau mà không phá tương thích.
- Gọi API thu hồi token của Apple khi xóa tài khoản. Apple yêu cầu việc này trước khi phát hành, nên làm cùng `DELETE /v1/me` ở giai đoạn 2.
- Liên kết nhiều nhà cung cấp vào một tài khoản.

## Ảnh hưởng đến app

- App dùng `expo-apple-authentication` và Google Sign-In, gửi `identityToken`/`idToken` lên server. Với Apple, gửi kèm tên đầy đủ ở lần đăng nhập đầu, vì Apple chỉ trả tên đúng một lần.
- Phản hồi giống `dev-login`: `{ user: { id, name }, accessToken, refreshToken, expiresIn }`.
- `src/schemas` có thêm `SocialLoginRequest`, cần chép lại.
- Bundle id (iOS) và các client id Google (iOS, Android, web) phải khớp với `APPLE_CLIENT_IDS` và `GOOGLE_CLIENT_IDS` của server.

## Capabilities

### New Capabilities

- `social-login`: đăng nhập bằng id token của Apple và Google.

### Modified Capabilities

_Không có._ Luật `role`/`firstSeenAt` cho người dùng mới đã nằm trong `auth` (change expand-sync), và việc cấp token qua phiên nằm trong change refresh-token-rotation.

## Impact

- Code: `src/lib/idToken.ts` (mới), `src/routes/auth.ts`, `src/config.ts`, `src/deps.ts`, `src/server.ts`, `src/schemas`, `.env.example`.
- Phụ thuộc: dùng `createRemoteJWKSet` và `jwtVerify` của jose đang có, không thêm thư viện.
- Mạng: server gọi `https://appleid.apple.com/auth/keys` và `https://www.googleapis.com/oauth2/v3/certs` để lấy khóa công khai (jose tự lưu đệm).
- Phụ thuộc thứ tự: làm sau refresh-token-rotation để cấp token qua `issueSession`.
