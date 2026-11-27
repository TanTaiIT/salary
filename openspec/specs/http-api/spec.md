# HTTP API Specification

## Purpose

Hành vi chung của mọi route HTTP: định dạng lỗi, request id, đọc body, giới hạn tần suất, kiểm tra sức khỏe, cấu hình khi khởi động và tắt server an toàn. Server dùng `node:http` thuần, không framework.

## Requirements

### Requirement: Định dạng lỗi thống nhất

Mọi phản hồi lỗi MUST có dạng `{ "error": { "code", "message", "details" }, "requestId" }`, với `message` bằng tiếng Việt. Lỗi không lường trước MUST trả 500 với `code = "internal_error"` và không để lộ chi tiết nội bộ.

#### Scenario: Đường dẫn không tồn tại

- **WHEN** gọi `GET /khong-co`
- **THEN** server trả 404 với `error.code = "not_found"` và có `requestId`

#### Scenario: Sai phương thức

- **WHEN** gọi `DELETE /health`
- **THEN** server trả 405 với `error.code = "method_not_allowed"`
- **AND** header `Allow` liệt kê các phương thức hợp lệ (`GET`)

#### Scenario: Lỗi không lường trước

- **WHEN** một handler ném lỗi không phải `HttpError`
- **THEN** server trả 500 với `error.code = "internal_error"` và ghi log lỗi kèm `requestId`

### Requirement: Request id

Mỗi request MUST có một request id được trả trong header `x-request-id` và có trong mọi log của request đó. Server MUST dùng lại `x-request-id` client gửi lên nếu khớp `^[\w-]{8,64}$`, nếu không thì tạo UUID mới.

#### Scenario: Client gửi request id hợp lệ

- **WHEN** gọi `/health` với header `x-request-id: abc-12345`
- **THEN** phản hồi có header `x-request-id: abc-12345`

#### Scenario: Client gửi request id không hợp lệ

- **WHEN** gọi `/health` với header `x-request-id: x`
- **THEN** phản hồi có `x-request-id` là một UUID mới

### Requirement: Đọc body JSON

Route có body MUST yêu cầu `Content-Type: application/json` và body không vượt quá `BODY_LIMIT_BYTES` (mặc định 512.000 byte, đủ cho gói `/v1/sync` lớn nhất: 500 bản mỗi loại với mọi trường ở độ dài tối đa). Dữ liệu sai schema MUST trả 422 với `details` là danh sách `{ path, message }` cho từng trường.

#### Scenario: Sai Content-Type

- **WHEN** gửi body với `Content-Type: text/plain`
- **THEN** server trả 415 với `error.code = "unsupported_media_type"`

#### Scenario: Body quá lớn

- **WHEN** gửi body lớn hơn giới hạn
- **THEN** server trả 413 với `error.code = "payload_too_large"` và đóng kết nối

#### Scenario: JSON hỏng hoặc rỗng

- **WHEN** gửi body `{hỏng`
- **THEN** server trả 400 với `error.code = "invalid_json"`
- **AND** body rỗng trả 400 với `error.code = "empty_body"`

#### Scenario: Dữ liệu sai schema

- **WHEN** gửi ngày công có `date = "2026-02-30"`
- **THEN** server trả 422 với `error.code = "validation_failed"` và `details` có phần tử với `path = "date"`

### Requirement: Giới hạn tần suất

Server MUST giới hạn 300 yêu cầu mỗi phút mỗi IP cho mọi route, và thêm 10 yêu cầu mỗi phút mỗi IP cho các route đăng nhập. `TRUST_PROXY` là số proxy đứng trước server (`false` = 0, `true` = 1, hoặc một số từ 0 đến 10). Khi lớn hơn 0, IP MUST lấy từ phần tử thứ `TRUST_PROXY` tính từ **cuối** `X-Forwarded-For` (phần tử đầu nếu danh sách ngắn hơn), vì các phần tử trước đó do client tự ghi; khi bằng 0 hoặc không có header thì lấy IP của kết nối.

#### Scenario: Vượt giới hạn đăng nhập

- **WHEN** một IP gọi `/v1/auth/refresh` lần thứ 11 trong một phút
- **THEN** server trả 429 với `error.code = "rate_limited"`

#### Scenario: Client giả X-Forwarded-For sau proxy

- **WHEN** `TRUST_PROXY = 1` và client gửi `X-Forwarded-For: 6.6.6.6` khác nhau ở mỗi lần gọi, proxy nối IP thật vào cuối
- **THEN** server tính giới hạn theo IP thật, và lần gọi vượt giới hạn vẫn nhận 429

### Requirement: Header an toàn

Mọi phản hồi MUST có `x-content-type-options: nosniff` và `cache-control: no-store`; phản hồi có body MUST có `content-type: application/json; charset=utf-8`.

#### Scenario: Phản hồi thành công

- **WHEN** gọi `GET /health`
- **THEN** phản hồi có `cache-control: no-store` và `x-content-type-options: nosniff`

### Requirement: Kiểm tra sức khỏe

`GET /health` MUST không cần đăng nhập và trả trạng thái kết nối MongoDB: 200 với `{ status: "ok", db: true, uptime }` khi ping được, 503 với `{ status: "degraded", db: false, uptime }` khi không.

#### Scenario: MongoDB mất kết nối

- **WHEN** ping MongoDB thất bại
- **THEN** `/health` trả 503 với `status = "degraded"`

### Requirement: Cấu hình khi khởi động

Server MUST kiểm tra biến môi trường khi khởi động và từ chối chạy nếu sai, đặc biệt `JWT_SECRET` phải có ít nhất 32 ký tự, `MONGODB_URI` phải bắt đầu bằng `mongodb`, và `NODE_ENV` MUST được đặt rõ (`development`, `test` hoặc `production`), không có giá trị mặc định. Khi `NODE_ENV` khác `production`, server MUST ghi cảnh báo vào log lúc khởi động.

#### Scenario: JWT_SECRET quá ngắn

- **WHEN** khởi động với `JWT_SECRET` 20 ký tự
- **THEN** server dừng với thông báo JWT_SECRET cần ít nhất 32 ký tự

#### Scenario: Thiếu NODE_ENV

- **WHEN** khởi động mà không đặt `NODE_ENV`
- **THEN** server dừng với thông báo NODE_ENV bắt buộc, thay vì ngầm chạy như development (bật dev-login)

### Requirement: Tắt server an toàn

Khi nhận `SIGTERM` hoặc `SIGINT`, server MUST ngừng nhận kết nối mới, chờ request đang chạy xong, đóng MongoDB rồi thoát với mã 0; nếu quá 10 giây chưa xong thì thoát với mã 1.

#### Scenario: Nhận SIGTERM

- **WHEN** server nhận `SIGTERM` khi không có request nào đang chạy
- **THEN** server đóng kết nối MongoDB và thoát với mã 0
