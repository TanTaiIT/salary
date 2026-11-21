# Đặc tả dự án: Lịch Lương Hàn Quốc

Tạo 17/11/2026 · Tai Nguyen · Cập nhật 21/11/2026: tách server và app React Native thành hai repo riêng

## Tổng quan

Lịch Lương Hàn Quốc là app di động giúp người lao động tại Hàn Quốc, trước hết là người Việt, chấm công mỗi ngày và biết trước lương tháng, tính theo luật lao động Hàn Quốc.

**Vấn đề.** Người lao động làm nhiều loại giờ với hệ số khác nhau (cơ bản, tăng ca, đêm, ngày nghỉ), thường không tự kiểm tra được bảng lương của chủ. Khoản lương ngày nghỉ tuần (주휴수당) hay bị bỏ sót vì ít người biết điều kiện được hưởng.

**Người dùng mục tiêu.** Người Việt làm part-time (알바), công nhân nhà máy, du học sinh làm thêm. Một người có thể làm cùng lúc nhiều nơi với mức lương giờ khác nhau.

**Mục tiêu sản phẩm:**

- Ghi một ngày công trong dưới 10 giây.
- Cùng dữ liệu đầu vào, số tiền app tính ra lệch 0 won so với công thức chuẩn.
- Dùng được hoàn toàn khi không có mạng; dữ liệu không mất khi đổi máy.
- Nhắc người dùng khi đủ điều kiện hưởng 주휴수당.

**Ngoài phạm vi giai đoạn đầu.** App không phải phần mềm trả lương cho doanh nghiệp và không thay cho tư vấn pháp lý. App không tự xác định hệ số tăng ca theo luật (người dùng tự chọn hệ số), và không tính quyết toán thuế thu nhập cuối năm.

**Mô hình kinh doanh.** App miễn phí hoàn toàn, thu nhập từ quảng cáo. Quảng cáo tăng dần theo thời gian mỗi người dùng gắn bó: 3 tháng đầu chỉ có banner ở các màn phụ, và không bao giờ chen vào lúc chấm công (xem mục [Quảng cáo](#quảng-cáo)).

## Tính năng

MVP gồm lịch chấm công, bảng nhập giờ theo hệ số, tổng lương tháng và đồng bộ; các tính năng còn lại làm sau khi có người dùng thật.

| Tính năng | Mô tả | Giai đoạn |
|---|---|---|
| Lịch tháng | Lịch bắt đầu từ CN; mỗi ô hiện số giờ (màu theo loại giờ nhiều nhất) và tiền ngày dạng “103k”. Cuối tuần, ngày lễ tô hồng | MVP |
| Chấm công một ngày | Bảng trượt từ dưới lên: người dùng tự chọn số giờ cho 5 hệ số x1, x1.5, x2, x2.5, x3, bước 0,5 giờ; tiền trợ cấp; tổng lương ngày hiện ngay khi nhập. Không có giờ vào, giờ ra | MVP |
| Tổng quan tháng | Tổng lương dự kiến, tổng giờ cơ bản, tổng giờ tăng ca, tổng trợ cấp | MVP |
| Gợi ý 주휴수당 | Khi tuần có từ 15 giờ cơ bản, hiện banner hỏi có thêm lương ngày nghỉ tuần không | MVP |
| Nhiều nơi làm việc | Mỗi nơi có tên, lương giờ, quy mô công ty; lịch lọc theo nơi | MVP |
| Dùng không cần đăng nhập | Mở app là dùng được, dữ liệu lưu trên máy | MVP |
| Đăng nhập và đồng bộ | Không bắt buộc. Đăng nhập Apple, Google để sao lưu và dùng trên nhiều máy; lần đầu đăng nhập, dữ liệu trên máy được đẩy lên server | MVP |
| Thống kê | Lương theo tuần, chi tiết theo loại giờ, trung bình mỗi ngày | Giai đoạn 2 |
| Lịch sử | Danh sách ngày công trong tháng, bấm vào để sửa | Giai đoạn 2 |
| Lương thực nhận | Khấu trừ theo các khoản và tỉ lệ người dùng tự nhập (ví dụ thuế 3,3% hoặc 4 bảo hiểm) để ước tính tiền về tài khoản | Giai đoạn 2 |
| Nhắc chấm công | Thông báo cuối ngày nếu chưa ghi ngày công | Giai đoạn 2 |
| Quảng cáo | Tăng dần theo thời gian sử dụng: 3 tháng đầu chỉ banner ở màn Thống kê, Lịch sử, Cài đặt; bật, tắt và ngưỡng chỉnh từ server. Chi tiết ở mục Quảng cáo | Giai đoạn 2 |
| Trang quản trị | Trang web cho admin sửa quy định từng năm: lương tối thiểu, ngày lễ, điều kiện 주휴수당; có nhật ký thay đổi | Giai đoạn 2 |
| Xuất báo cáo | Bảng lương tháng dạng PDF để đối chiếu với chủ | Giai đoạn 3 |
| Đăng nhập Kakao, tiếng Hàn | Mở rộng cho người dùng không phải người Việt | Giai đoạn 3 |

Giao diện tham khảo là prototype “Lịch Lương Hàn Quốc” đã dựng: header xanh, lịch lưới 7 cột, nút “Thêm ngày công” cố định phía dưới, thanh tab Trang chủ, Thống kê, Lịch sử, Cài đặt.

## Quy tắc tính lương

Mọi phép tính nằm trong `src/payroll/` của repo server. App React Native dùng bản chép của đúng thư mục này (xem [Code dùng chung](#code-dùng-chung-giữa-server-và-app)), nên hai bên luôn ra cùng một con số.

Tiền công một ngày là tổng số giờ của từng loại nhân lương giờ và hệ số, cộng tiền trợ cấp:

$$
\text{Lương ngày} = \left\lfloor \sum_{k} h_k \times m_k \times w \right\rfloor + \text{trợ cấp}
$$

Trong đó h là số giờ, m là hệ số (1; 1,5; 2; 2,5; 3), w là lương giờ lưu cùng ngày công đó.

Lương ngày nghỉ tuần (주휴수당) được tính khi tuần (T2 đến CN) có từ 15 giờ cơ bản trở lên, ghi vào ngày CN cuối tuần:

$$
\text{주휴수당} = \left\lfloor \frac{\min(H, 40)}{40} \times 8 \times w \right\rfloor
$$

H là tổng giờ cơ bản trong tuần. Luật còn yêu cầu đi làm đủ các ngày đã thỏa thuận; app không biết điều này nên chỉ gợi ý, người dùng xác nhận.

**Quy ước bắt buộc:**

- Tiền là số nguyên won; phần lẻ dưới 1 won bị bỏ (절사), chỉ làm tròn ở bước cuối.
- Số giờ là bội số của 0,5; tổng giờ một ngày không quá 24.
- Ngày công là chuỗi `"YYYY-MM-DD"` theo giờ Hàn Quốc, không dùng kiểu `Date`.
- Mỗi ngày công lưu lương giờ tại thời điểm làm (`wageSnapshot`); đổi lương giờ không làm thay đổi các tháng cũ.
- Tổng tháng gồm tiền công các ngày, trợ cấp và 주휴수당 của những tuần có ngày CN nằm trong tháng.

Quy định theo năm lưu trong database, không viết cứng trong code: lương tối thiểu (2026 là 10.320 ₩/giờ), danh sách ngày lễ, điều kiện 주휴수당. App tải về và lưu đệm; khi luật đổi chỉ cần cập nhật server.

Khấu trừ (giai đoạn 2) chỉ để ước tính. Các khoản khấu trừ và tỉ lệ (ví dụ thuế 3,3% cho hợp đồng tự do, hoặc 4 bảo hiểm) do người dùng tự nhập, vì mỗi người có hợp đồng khác nhau; server không lưu tỉ lệ bảo hiểm trong `ruleSets`.

## Kiến trúc

Dự án gồm hai repo độc lập: repo này là API Node.js thuần, app React Native nằm ở repo riêng. Công thức lương và luật kiểm tra dữ liệu chỉ viết một lần ở server; app dùng bản chép của hai thư mục `src/payroll/` và `src/schemas/`.

```
App React Native (repo riêng)               Server Node.js (repo này)
┌──────────────────────────────┐            ┌──────────────────────────────────┐
│ Giao diện, SQLite trên máy   │  HTTPS /v1 │ src/routes, src/services         │
│ payroll/, schemas/ (bản chép)│ ─────────▶ │ src/payroll, src/schemas (bản gốc)│
└──────────────────────────────┘            │ src/db ──▶ MongoDB               │
                                            └──────────────────────────────────┘
```

App tính lương ngay trên máy để phản hồi tức thì; server tính lại bằng chính lõi đó khi đồng bộ và làm báo cáo.

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Runtime server | Node.js, chạy TypeScript trực tiếp | 26 LTS (26.13) |
| Quản lý gói | pnpm (một package, không dùng workspaces) | 12.21 |
| Kiểm tra kiểu | TypeScript | 7.0 |
| Database | MongoDB, driver chính thức `mongodb` | 8 / driver 7.9 |
| Kiểm tra dữ liệu | zod | 4.6 |
| Token | jose | 6.2 |
| Kiểm thử | `node:test` có sẵn trong Node | 26 |
| App | React Native (Expo), SQLite trên máy; repo riêng | chưa chốt |
| Quảng cáo | Google AdMob qua `react-native-google-mobile-ads`; Firebase Analytics để đo giữ chân người dùng | chưa chốt |
| Trang quản trị | Web gọi `/v1/admin`; repo riêng hoặc phục vụ từ server | chưa chốt |

### Cấu trúc repo server

```
src/
  server.ts      khởi động, kết nối MongoDB, tắt an toàn
  app.ts         xử lý request: request id, rate limit, router, xác thực, lỗi
  config.ts      đọc và kiểm tra biến môi trường
  lib/           router, đọc body, JWT, rate limit, logger
  db/            kiểu document, collection, index
  services/      logic ghi ngày công (bản sửa mới nhất thắng)
  routes/        health, auth, rules, jobs, work-days, sync
  payroll/       lõi tính lương, dùng chung với app
  schemas/       schema zod và hàm thuần dùng chung với app
scripts/         seed quy định, cấu hình
test/            test API, payroll, schema
```

### Code dùng chung giữa server và app

- `src/payroll/` và `src/schemas/` của repo server là **bản gốc**. App chép nguyên hai thư mục này; không sửa trực tiếp bản chép trong app.
- Hai thư mục này chỉ được import lẫn nhau và thư viện `zod`. Không import module riêng của Node (`node:fs`, `node:crypto`…), thư viện chỉ chạy trên server, hay code khác trong `src/`.
- Mọi thay đổi ở hai thư mục này phải có test trong repo server (`test/payroll/`, `test/schemas.test.ts`), rồi chép sang app trong cùng đợt phát hành.
- Nếu việc chép tay bắt đầu gây lệch giữa hai bên, chuyển hai thư mục thành package riêng (registry private hoặc git dependency).

**Quy ước code:** import nội bộ ghi rõ đuôi `.ts`; không dùng `enum`, `namespace`, parameter properties (Node chỉ bỏ được cú pháp kiểu thuần).

## Mô hình dữ liệu

MongoDB có 8 collection; ngày công tách riêng, không nhúng vào người dùng hay nơi làm việc để tránh document phình theo năm.

| Collection | Trường chính | Index |
|---|---|---|
| `users` | `_id` (UUID), `name`, `provider` (apple, google, kakao, dev), `providerId`, `role` (user, admin), `firstSeenAt`, `createdAt` | unique `provider` + `providerId` |
| `jobs` | `_id` (UUID do app tạo), `userId`, `name`, `hourlyWage`, `companySize` (under5, 5plus), `createdAt`, `updatedAt`, `deletedAt`, `serverUpdatedAt` | `userId` + `deletedAt`; `userId` + `serverUpdatedAt` |
| `workDays` | `_id` (UUID do app tạo), `userId`, `jobId`, `date` (“YYYY-MM-DD”), `hours` {x1, x1_5, x2, x2_5, x3}, `allowance`, `wageSnapshot`, `updatedAt`, `deletedAt`, `serverUpdatedAt` | unique `userId` + `jobId` + `date` (chỉ bản chưa xóa); `userId` + `date`; `userId` + `serverUpdatedAt` |
| `weeklyHolidayPays` | `_id`, `userId`, `jobId`, `weekStart` (thứ Hai), `amount`, `updatedAt`, `deletedAt`, `serverUpdatedAt` | unique `userId` + `jobId` + `weekStart` (chỉ bản chưa xóa); `userId` + `serverUpdatedAt` |
| `ruleSets` | `_id` (năm, ví dụ “2026”), `minimumWage`, `holidays` [{date, name}], `weeklyHoliday` {minHours, maxHours, paidHours}, `updatedAt`, `updatedBy` | theo `_id` |
| `appConfig` | `_id` (“current”), `ads` {enabled, tiers, caps}, `minAppVersion`, `updatedAt` | theo `_id` |
| `auditLogs` | `_id`, `actorId`, `action`, `target` (ví dụ “ruleSets/2026”), `before`, `after`, `at` | `target` + `at` |
| `sessions` | `_id` (jti của refresh token), `userId`, `createdAt`, `expiresAt`, `rotatedAt` | TTL theo `expiresAt`; `userId` |

Không có trường giờ vào, giờ ra: ngày công chỉ lưu số giờ theo từng hệ số. Nơi làm việc (`jobs`) cũng do app tạo `_id` khi chưa đăng nhập, nên đồng bộ giống ngày công.

`updatedAt` là thời điểm sửa trên máy người dùng, dùng để giải quyết xung đột. `serverUpdatedAt` là thời điểm server ghi nhận, dùng làm mốc kéo dữ liệu khi đồng bộ. Xóa luôn là xóa mềm (`deletedAt`) để các máy khác nhận được việc xóa.

## API

API REST trả JSON, phiên bản trong đường dẫn (`/v1`); mọi route trừ health, config, auth, rules đều cần access token.

| Phương thức | Đường dẫn | Đăng nhập | Mục đích |
|---|---|---|---|
| GET | `/health` | Không | Trạng thái server và kết nối MongoDB |
| GET | `/v1/config` | Không | Cấu hình app: quảng cáo (bật, tắt, các cấp, giới hạn), phiên bản app tối thiểu |
| POST | `/v1/auth/apple`, `/v1/auth/google` | Không | Đổi id token của nhà cung cấp lấy cặp token; chỉ lưu tên hiển thị và mã người dùng của nhà cung cấp |
| POST | `/v1/auth/dev-login` | Không | Đăng nhập bằng tên, chỉ có ngoài production |
| POST | `/v1/auth/refresh` | Không | Đổi refresh token lấy cặp token mới (xoay vòng) |
| POST | `/v1/auth/logout` | Không | Thu hồi phiên của refresh token |
| GET | `/v1/rules/:year` | Không | Quy định của năm |
| GET, POST | `/v1/jobs` | Có | Xem, thêm nơi làm việc |
| GET | `/v1/work-days?month=YYYY-MM&jobId=` | Có | Ngày công trong tháng kèm tổng lương |
| PUT | `/v1/work-days/:id` | Có | Tạo hoặc sửa một ngày công |
| DELETE | `/v1/work-days/:id` | Có | Xóa mềm một ngày công |
| POST | `/v1/sync` | Có | Đồng bộ hai chiều nơi làm việc, ngày công, 주휴수당 và `firstOpenAt` |
| DELETE | `/v1/me` | Có | Xóa tài khoản và toàn bộ dữ liệu |
| GET | `/v1/admin/rules` | Admin | Danh sách quy định các năm |
| PUT | `/v1/admin/rules/:year` | Admin | Tạo hoặc sửa quy định một năm, ghi `auditLogs` |
| GET | `/v1/admin/audit-logs` | Admin | Xem nhật ký thay đổi |

**Xác thực.** JWT ký HS256: access token sống 15 phút, refresh token 30 ngày, gửi qua header `Authorization: Bearer`. Route admin kiểm tra thêm `role = admin` trong database, không tin vào token. Mỗi refresh token gắn với một phiên trong `sessions`: refresh thì phiên cũ bị đánh dấu đã dùng và cấp phiên mới; gửi lại token đã dùng thì mọi phiên của người dùng bị thu hồi. App phải lưu refresh token mới sau mỗi lần refresh và không gọi refresh song song.

**Định dạng lỗi** thống nhất cho mọi route:

```json
{ "error": { "code": "validation_failed", "message": "Dữ liệu không hợp lệ", "details": [{ "path": "date", "message": "…" }] }, "requestId": "…" }
```

Mã trạng thái dùng: 400 JSON hỏng, 401 thiếu hoặc sai token, 404 không tìm thấy, 405 sai phương thức, 409 trùng ngày hoặc bản sửa cũ hơn, 413 body quá lớn, 415 sai Content-Type, 422 dữ liệu sai, 429 gọi quá nhiều, 500 lỗi server.

## Đồng bộ offline

App ghi vào SQLite trên máy trước, đồng bộ lên server khi có mạng; xung đột giải quyết theo nguyên tắc bản sửa mới nhất thắng.

1. Người dùng lưu ngày công: app ghi vào SQLite với id UUID mới (nếu là ngày mới), `updatedAt` = giờ máy, đánh dấu “chưa đồng bộ”.
2. Khi có mạng (mở app, quay lại app, hoặc sau khi lưu), app gọi `POST /v1/sync` gửi các bản chưa đồng bộ cùng `since` = mốc `serverTime` lần trước. Một gói gồm `jobs`, `workDays` và `weeklyHolidayPays` (mỗi loại tối đa 500 bản) cùng `firstOpenAt`.
3. Server xử lý nơi làm việc trước, rồi ngày công, rồi 주휴수당. Với từng bản: nếu bản trên server có `updatedAt` mới hơn hoặc bằng thì giữ bản server (`stale`); nếu không thì ghi đè (`applied`); bản lỗi trả `rejected` kèm mã lỗi.
4. Server trả về mọi bản ghi của cả ba loại có `serverUpdatedAt` sau `since`, cùng `serverTime` mới và `firstOpenAt` sớm nhất của tài khoản. `serverTime` lùi 5 giây so với lúc xử lý để không sót bản ghi của máy khác đang ghi dở, nên lần sau app có thể nhận lại vài bản đã có. Nếu `hasMore = true`, app gọi lại ngay với mốc vừa nhận.
5. App gộp dữ liệu nhận về theo id (giữ bản có `updatedAt` mới hơn), bỏ đánh dấu các bản `applied` hoặc `stale`, lưu `serverTime` làm mốc cho lần sau.

**Trường hợp đặc biệt:**

- Hai bản khác id cho cùng nơi làm và cùng ngày (tạo trên hai máy khi offline): server trả `rejected` với `duplicate_day`; app hiện cả hai để người dùng chọn giữ bản nào. 주휴수당 trùng tuần tương tự với `duplicate_week`.
- Xóa nơi làm việc không tự xóa ngày công của nơi đó: app gửi kèm việc xóa các ngày công nếu người dùng muốn. Server nhận việc xóa ngày công của nơi làm đã xóa, nhưng từ chối tạo hoặc sửa (`unknown_job`).
- Giờ máy người dùng sai lệch nhiều có thể làm bản cũ thắng bản mới; chấp nhận ở MVP, ghi nhận nếu người dùng báo lỗi.
- Bản bị `rejected` giữ lại trên máy và hiện cảnh báo, không tự xóa.
- Xóa nơi làm việc: app xóa mềm luôn mọi ngày công và 주휴수당 của nơi làm đó, rồi gửi cả các thay đổi xóa trong cùng gói. Server không tự lọc ngày công theo nơi làm đã xóa khi tính tổng tháng, và vẫn nhận thay đổi xóa ngày công của nơi làm đã xóa.

**Người dùng chưa đăng nhập.** App vẫn ghi đầy đủ ngày công và nơi làm việc vào SQLite, chỉ không gọi `/v1/sync`. Khi đăng nhập lần đầu, app gửi toàn bộ dữ liệu trên máy với `since = null`; nếu tài khoản đã có dữ liệu từ máy khác, hai bên được gộp theo id và nguyên tắc bản sửa mới nhất thắng. Nơi làm việc cũng do app tạo id, nên dữ liệu tạo khi chưa đăng nhập được đẩy lên nguyên vẹn.

## Quảng cáo

Quảng cáo tăng dần theo thời gian mỗi người dùng gắn bó với app: 3 tháng đầu chỉ có banner ở các màn phụ, sau đó mới thêm các loại khác, và mọi ngưỡng đều chỉnh được từ server mà không cần phát hành bản mới.

**Nguyên tắc:**

- Không bao giờ có quảng cáo trong bảng chấm công, màn đăng nhập, màn xóa tài khoản và lần mở app đầu tiên.
- Không có quảng cáo toàn màn hình ngay sau khi lưu ngày công hoặc khi vừa mở app.
- Banner cách nút bấm ít nhất 8 px và không che nội dung; lỗi tải quảng cáo không được ảnh hưởng chức năng nào.
- Nếu không tải được cấu hình quảng cáo, app chạy như cấp 1.

### Các cấp quảng cáo

“Số ngày sử dụng” tính từ lần mở app đầu tiên; “ngày có chấm công” là số ngày khác nhau người dùng đã ghi ngày công. Cả hai điều kiện phải đạt mới lên cấp.

| Cấp | Điều kiện | Quảng cáo được bật |
|---|---|---|
| 1 – Làm quen | Từ ngày đầu tiên | Banner cuối màn Thống kê, Lịch sử, Cài đặt. Trang chủ không có quảng cáo |
| 2 – Quen dùng | Từ ngày 90 và có ít nhất 30 ngày có chấm công | Thêm banner trên Trang chủ, quảng cáo native trong danh sách Lịch sử, quảng cáo có thưởng (người dùng tự chọn xem) |
| 3 – Lâu năm | Từ ngày 180, chỉ bật khi số liệu giữ chân người dùng không giảm sau khi bật cấp 2 | Thêm quảng cáo toàn màn hình, tối đa 1 lần mỗi ngày, chỉ khi rời màn Thống kê |

### Vị trí quảng cáo

| Mã vị trí | Vị trí | Loại | Từ cấp |
|---|---|---|---|
| `stats_bottom` | Cuối màn Thống kê, trên thanh tab | Banner thích ứng (adaptive) | 1 |
| `history_bottom` | Cuối màn Lịch sử, trên thanh tab | Banner thích ứng | 1 |
| `settings_bottom` | Cuối màn Cài đặt, trên thanh tab | Banner thích ứng | 1 |
| `home_overview` | Dưới thẻ Tổng quan tháng, không sát nút “Thêm ngày công” | Banner thích ứng | 2 |
| `history_native` | Trong danh sách Lịch sử, một quảng cáo sau mỗi 10 ngày công, ghi rõ “Quảng cáo” | Native | 2 |
| `rewarded_unlock` | Nút “Xem quảng cáo để mở” cho thống kê nâng cao của tháng (sau này cả xuất PDF) | Có thưởng | 2 |
| `stats_interstitial` | Khi rời màn Thống kê | Toàn màn hình | 3 |

### Cấu hình từ server

App tải cấu hình qua `GET /v1/config`, lưu đệm 12 giờ. Mã ad unit thật nằm trong cấu hình build của app; server chỉ quyết định bật, tắt và ngưỡng.

```json
{
  "ads": {
    "enabled": true,
    "tiers": [
      { "tier": 1, "minDays": 0, "minActiveDays": 0, "placements": ["stats_bottom", "history_bottom", "settings_bottom"] },
      { "tier": 2, "minDays": 90, "minActiveDays": 30, "placements": ["home_overview", "history_native", "rewarded_unlock"] },
      { "tier": 3, "minDays": 180, "minActiveDays": 60, "placements": ["stats_interstitial"], "enabled": false }
    ],
    "caps": { "interstitialPerDay": 1, "nativeEvery": 10 }
  }
}
```

Đặt `enabled = false` là tắt toàn bộ quảng cáo; đặt `enabled = false` trong một cấp là tắt riêng cấp đó.

### Cách triển khai

- **Server, `src/schemas/ads.ts`:** schema zod `AdConfig` và hàm thuần `adTier(stats, config)` trả về cấp hiện tại cùng danh sách vị trí được bật. Hàm này có unit test cho từng ngưỡng trong repo server, và được app dùng qua bản chép `schemas/`.
- **App (repo React Native):** thư viện `react-native-google-mobile-ads` (Google AdMob). Một `AdsProvider` ở gốc app chạy theo thứ tự: xin đồng ý (UMP) → hỏi quyền theo dõi trên iOS → khởi động SDK. Màn hình chỉ đặt `<AdSlot placement="stats_bottom" />`; component tự quyết định có hiện hay không theo `adTier`.
- **Số liệu để tính cấp:** `firstOpenAt` và số ngày có chấm công lưu trong SQLite. Khi người dùng đăng nhập, lấy `firstOpenAt` sớm nhất giữa máy và server (`users.firstSeenAt`) để cài lại app không bị coi là người mới.
- **Server, route:** `GET /v1/config` đọc từ collection `appConfig`; chỉnh cấu hình bằng script seed trong `scripts/`.
- **Phát triển và kiểm thử:** bản dev luôn dùng TestIds; có menu ẩn trong bản dev để ép cấp 1, 2, 3 khi kiểm tra giao diện.

### Đo lường

Cấp 2 và 3 chỉ được bật rộng rãi khi số liệu cho thấy người dùng không bỏ đi.

| Chỉ số | Nguồn | Dùng để |
|---|---|---|
| Người dùng hoạt động mỗi ngày (DAU) | Firebase Analytics | Theo dõi quy mô |
| Tỉ lệ quay lại ngày 7, 30, 90 | Firebase Analytics | So sánh trước và sau khi lên cấp 2, 3 |
| Số lần hiển thị mỗi người mỗi ngày, theo cấp | Sự kiện `ad_impression` kèm `tier`, `placement` | Kiểm soát mật độ quảng cáo |
| eCPM và doanh thu theo vị trí | Báo cáo AdMob | Bỏ vị trí trả thấp mà gây phiền |
| Tỉ lệ gỡ app trong 7 ngày sau khi lên cấp | Firebase Analytics | Điều kiện để giữ hoặc lùi ngưỡng |

**Quy tắc ra quyết định:** nếu tỉ lệ quay lại ngày 30 của nhóm vừa lên cấp 2 giảm quá 5 điểm phần trăm so với nhóm chưa lên, lùi ngưỡng hoặc tắt vị trí gây giảm.

## Bảo mật và quyền riêng tư

App giữ dữ liệu lương và giờ làm cá nhân, nên mỗi người chỉ đọc được dữ liệu của mình và app thu thập ít thông tin nhất có thể.

- Mọi truy vấn MongoDB đều lọc theo `userId` lấy từ token, không bao giờ lấy từ body hay query.
- Chỉ lưu tên hiển thị và mã người dùng của nhà cung cấp đăng nhập; không lưu số điện thoại, số thẻ người nước ngoài hay tên công ty thật nếu người dùng không nhập.
- Token lưu trên máy bằng SecureStore (Keychain/Keystore), không lưu trong AsyncStorage.
- Giới hạn tần suất: 300 yêu cầu/phút mỗi IP, 10 lần đăng nhập/phút mỗi IP; chuyển sang Redis khi chạy nhiều instance.
- Body tối đa 100 KB; dữ liệu đầu vào kiểm tra bằng schema zod dùng chung.
- Chỉ chạy qua HTTPS; `JWT_SECRET` tối thiểu 32 ký tự, chỉ nằm trong biến môi trường.
- Người dùng xóa được tài khoản và toàn bộ dữ liệu trong app (Apple yêu cầu với app có tạo tài khoản).
- Cần chính sách quyền riêng tư bằng tiếng Việt và tiếng Hàn trước khi phát hành, theo luật bảo vệ thông tin cá nhân của Hàn Quốc (PIPA).
- Thư viện bên thứ ba: khóa phiên bản bằng lockfile ở cả hai repo; cân nhắc `minimumReleaseAge` của pnpm để không cài bản vừa phát hành.

**Quảng cáo:**

- Không gửi bất kỳ dữ liệu lương, giờ làm hay nơi làm việc nào cho mạng quảng cáo hay Firebase Analytics; sự kiện chỉ chứa cấp và mã vị trí quảng cáo.
- iOS: hỏi quyền theo dõi (App Tracking Transparency) trước khi hiện quảng cáo cá nhân hóa; bị từ chối thì hiện quảng cáo không cá nhân hóa.
- Dùng Google UMP để xin đồng ý ở khu vực có yêu cầu; khai báo đúng dữ liệu quảng cáo và phân tích trong App Privacy (App Store) và Data safety (Google Play).
- Có website kèm file `app-ads.txt` để AdMob xác minh chủ app.
- Bản dev luôn dùng TestIds; không ai trong nhóm bấm vào quảng cáo thật.

**Trang quản trị:**

- Chỉ tài khoản có `role = admin`; đăng nhập Google với danh sách email cho phép và bật xác minh 2 bước.
- Mọi thay đổi quy định ghi vào `auditLogs` với người sửa, thời điểm, giá trị cũ và mới.
- Đường dẫn admin có giới hạn tần suất riêng và không xuất hiện trong app di động.

## Yêu cầu phi chức năng

Mục tiêu là app phản hồi tức thì khi nhập liệu và lõi tính lương được kiểm thử kỹ hơn mọi phần khác.

| Hạng mục | Yêu cầu |
|---|---|
| Tốc độ app | Mở lịch tháng và lưu ngày công dưới 200 ms trên máy tầm trung, không chờ mạng |
| Tốc độ API | p95 dưới 300 ms cho các route đọc/ghi một tháng |
| Quảng cáo | SDK khởi động sau khi giao diện đã hiện, không làm chậm lúc mở app; banner tải bất đồng bộ và giữ sẵn chỗ để giao diện không bị nhảy |
| Kiểm thử lõi | `src/payroll/` phủ 100% nhánh; có test cho tuần vắt qua tháng, giờ lẻ 0,5, quá 40 giờ/tuần, năm nhuận |
| Kiểm thử quảng cáo | `adTier` có test cho từng ngưỡng; menu ẩn trong bản dev để ép cấp 1, 2, 3 |
| Kiểm thử API | Test HTTP cho lỗi 400, 401, 405, 413, 415, 422, 429; test tích hợp với MongoDB thật trong CI |
| Ngôn ngữ | Tiếng Việt khi ra mắt; chuỗi giao diện tách ra file dịch để thêm tiếng Hàn |
| Định dạng | Tiền hiển thị kiểu 3.245.000 ₩; ngày theo dd/mm; tuần hiển thị bắt đầu từ CN |
| Vận hành | Log JSON có `requestId`; `/health` cho bộ cân bằng tải; tắt server an toàn khi nhận SIGTERM |
| Hạ tầng | Node.js 26 LTS; MongoDB Atlas vùng Seoul; sao lưu tự động hằng ngày |

## Lộ trình

Dự án đi qua năm giai đoạn nối tiếp; mỗi giai đoạn chỉ bắt đầu khi giai đoạn trước đạt điều kiện hoàn thành.

1. **Nền tảng (đã xong phần lớn).** Repo server, `src/payroll`, schema dùng chung, API Node.js thuần với MongoDB, đăng nhập dev, đồng bộ.
   *Hoàn thành khi:* chạy được với MongoDB thật, test tích hợp qua CI, đồng bộ cả jobs.
2. **MVP.** App React Native (Expo) trong repo riêng: lịch, chấm công, tổng tháng, nhiều nơi làm, gợi ý 주휴수당, dùng không cần đăng nhập với SQLite; đăng nhập Apple, Google tùy chọn để đồng bộ. Chưa có quảng cáo.
   *Hoàn thành khi:* 20 người dùng thử dùng 2 tuần, bảng lương tính ra khớp bảng lương thật của họ.
3. **Giai đoạn 2: phát hành.** Thống kê, lịch sử, lương thực nhận, nhắc chấm công, trang quản trị quy định. Quảng cáo cấp 1 (banner ở 3 màn phụ), `GET /v1/config`, `adTier`, Firebase Analytics; phát hành App Store và Google Play.
   *Hoàn thành khi:* có chính sách quyền riêng tư, xóa tài khoản, khai báo quảng cáo, `app-ads.txt`, được duyệt trên hai kho ứng dụng.
4. **Giai đoạn 3: tăng quảng cáo.** Khoảng 3 tháng sau phát hành, khi nhóm người dùng đầu tiên đạt ngưỡng: bật cấp 2 (banner Trang chủ, native trong Lịch sử, quảng cáo có thưởng). Cấp 3 chỉ bật sau khi so sánh số liệu giữ chân người dùng.
   *Hoàn thành khi:* tỉ lệ quay lại ngày 30 của nhóm cấp 2 không giảm quá 5 điểm phần trăm.
5. **Giai đoạn 4.** Xuất PDF (kèm quảng cáo có thưởng), đăng nhập Kakao, giao diện tiếng Hàn, rate limit bằng Redis, mediation AdMob khi lượng người dùng đủ lớn.

## Quyết định đã chốt

Các câu hỏi mở đã có câu trả lời; riêng việc không bắt buộc đăng nhập là đề xuất, chờ xác nhận.

| Ngày | Quyết định |
|---|---|
| 21/11/2026 | Tách thành hai repo: server Node.js (repo này) và app React Native. Bỏ pnpm workspaces; `payroll-core` chuyển thành `src/payroll/`, `shared` thành `src/schemas/`; app dùng bản chép của hai thư mục này. |
| 21/11/2026 | Xóa nơi làm việc thì app chịu trách nhiệm xóa các ngày công và 주휴수당 của nơi làm đó; server không tự lọc. |
| 21/11/2026 | Khoản khấu trừ và tỉ lệ để tính lương thực nhận do người dùng tự nhập; không lưu tỉ lệ bảo hiểm theo năm trên server. |
