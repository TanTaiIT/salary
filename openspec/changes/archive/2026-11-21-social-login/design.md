# Design

## Context

Xem proposal.md (Why). jose 6.2 đã có trong dependencies và có `createRemoteJWKSet` (tải và lưu đệm JWKS, tự tải lại khi gặp `kid` lạ) cùng `jwtVerify`. `dev-login` đã có mẫu upsert người dùng theo `provider + providerId`, dựa trên index unique `uniq_provider`.

## Goals / Non-Goals

**Goals:**
- Kiểm tra id token đúng chuẩn mà không thêm thư viện.
- Test được toàn bộ luồng mà không gọi ra mạng.

**Non-Goals:**
- Nonce, Kakao, liên kết tài khoản (xem proposal).

## Decisions

### Bộ kiểm tra id token `src/lib/idToken.ts`

`createIdTokenVerifier(options)` trả `{ verify(provider, idToken): Promise<{ sub, name? }> }`. Với mỗi nhà cung cấp, options gồm `audiences: string[]`, `issuer: string | string[]` và `keys` (hàm lấy khóa của jose). Ở `server.ts`, `keys = createRemoteJWKSet(new URL(jwksUrl))` được tạo một lần khi khởi động. Trong test, `keys = createLocalJWKSet(...)` dùng cặp khóa RSA sinh bằng `generateKeyPair('RS256')`. Bộ kiểm tra được đưa vào `Deps` như `auth`, nên route không biết đang chạy thật hay test.

`jwtVerify(idToken, keys, { issuer, audience: audiences, algorithms: ['RS256'] })`. Mọi lỗi (chữ ký, `iss`, `aud`, `exp`, lỗi mạng khi tải JWKS) đều thành 401 `invalid_id_token`. Riêng lỗi mạng được ghi log `warn` để phân biệt khi vận hành.

*Phương án khác:* thư viện `google-auth-library` hoặc `apple-signin-auth`. Bỏ vì jose đã đủ, và thêm hai thư viện chỉ cho việc này làm tăng bề mặt phụ thuộc.

### Cấu hình

`APPLE_CLIENT_IDS` và `GOOGLE_CLIENT_IDS` (mặc định rỗng) được tách theo dấu phẩy, bỏ khoảng trắng và phần tử rỗng. Danh sách rỗng thì route trả 503 `provider_not_configured` trước khi gọi bộ kiểm tra.

### Upsert người dùng

Dùng chung một hàm với dev-login: `findOneAndUpdate({ provider, providerId: sub }, { $setOnInsert: { _id, name, provider, providerId, role: 'user', firstSeenAt: now, createdAt: now } }, { upsert: true, returnDocument: 'after' })`. Nếu hai lệnh đăng nhập đầu tiên chạy đồng thời và một lệnh gặp lỗi trùng khóa thì thử lại một lần. Sau đó cấp token qua `issueSession` (change refresh-token-rotation).

### Body

`SocialLoginRequest = { idToken: string (20 đến 10.000 ký tự), name?: string (1 đến 60 ký tự sau khi bỏ khoảng trắng) }`.

## Risks / Trade-offs

- [Máy chủ khóa của Apple hoặc Google tạm lỗi] → jose dùng khóa đã lưu đệm; khi chưa có đệm thì trả 401 và app cho thử lại. Log `warn` giúp phát hiện.
- [Phát lại id token bị đánh cắp trong thời gian còn hạn] → Rủi ro thấp vì token sống ngắn và gắn `aud`; thêm nonce ở change sau.
- [Apple yêu cầu thu hồi token khi xóa tài khoản] → Ghi vào Ngoài phạm vi, làm cùng `DELETE /v1/me` trước khi phát hành.

## Migration Plan

Thêm biến môi trường mới, mặc định rỗng nên route trả 503 cho tới khi cấu hình. Không đổi dữ liệu cũ.
