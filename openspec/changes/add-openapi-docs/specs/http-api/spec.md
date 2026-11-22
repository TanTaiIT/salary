# Spec Delta

## ADDED Requirements

### Requirement: Tài liệu OpenAPI

Ngoài production, server MUST trả tài liệu OpenAPI 3.1 tại `GET /openapi.json` và trang Swagger UI tại `GET /docs`, không cần đăng nhập. Tài liệu MUST liệt kê mọi route của server với đúng yêu cầu đăng nhập, schema dữ liệu gửi lên và trả về. Ở production, hai route này MUST NOT tồn tại.

#### Scenario: Lấy tài liệu

- **WHEN** gọi `GET /openapi.json` ở môi trường development
- **THEN** server trả 200 với `openapi = "3.1.0"` và có thao tác `post` tại `/v1/sync`

#### Scenario: Production

- **WHEN** server chạy với `NODE_ENV = production` và gọi `GET /docs`
- **THEN** server trả 404 với `error.code = "not_found"`

### Requirement: Tài liệu khớp code

File `openapi.json` ở gốc repo MUST là bản sinh từ code hiện tại, và mọi route khai báo trong router MUST có trong tài liệu. Phản hồi thật của các route MUST khớp schema phản hồi trong tài liệu, không có trường thừa.

#### Scenario: Thêm route mà quên tài liệu

- **WHEN** một route mới được đăng ký trong router nhưng chưa có trong tài liệu
- **THEN** `pnpm test` thất bại và chỉ ra route đó

#### Scenario: Quên ghi lại openapi.json

- **WHEN** schema đổi nhưng chưa chạy `pnpm openapi`
- **THEN** `pnpm test` thất bại với thông báo cần chạy `pnpm openapi`
