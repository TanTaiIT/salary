import { UserSettingsInput } from '../schemas/index.ts';
import { HttpError, noContent, ok, parse } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';
import { applySettings, meToApi, settingsToApi } from '../services/settings.ts';

export function meRoutes(r: Router): void {
  // Thông tin tài khoản cho màn Cài đặt: tên, cách đăng nhập, lần mở app đầu tiên, cài đặt đã đồng bộ
  r.get('/v1/me', async ({ deps, userId }) => {
    const user = await deps.cols.users.findOne({ _id: userId });
    if (!user) throw new HttpError(401, 'invalid_token', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    return ok(meToApi(user));
  });

  // Sửa cài đặt khi đang có mạng; khi offline app gửi qua /v1/sync. Bản sửa mới nhất thắng.
  r.put('/v1/me/settings', async ({ deps, userId, body }) => {
    const input = parse(UserSettingsInput, await body());
    const result = await applySettings(deps.cols, userId, input);
    if (result.status === 'stale') {
      throw new HttpError(409, 'stale_update', 'Cài đặt đã được sửa ở máy khác sau bản này', settingsToApi(result.settings));
    }
    return ok(settingsToApi(result.settings));
  });

  // Xóa tài khoản và toàn bộ dữ liệu (xóa hẳn, không phải xóa mềm) trong một transaction:
  // lỗi giữa chừng thì không mất gì, người dùng gọi lại được; không bao giờ còn dữ liệu sót một nửa.
  r.delete('/v1/me', async ({ deps, userId }) => {
    const { cols } = deps;
    await deps.withTransaction(async (session) => {
      // Chạy tuần tự: một session không được chạy song song nhiều thao tác trong transaction
      await cols.workDays.deleteMany({ userId }, { session });
      await cols.weeklyHolidayPays.deleteMany({ userId }, { session });
      await cols.jobs.deleteMany({ userId }, { session });
      // Không để phiên mồ côi chờ TTL dọn; refresh token cũ cũng bị từ chối vì user không còn
      await cols.sessions.deleteMany({ userId }, { session });
      // Cài đặt nằm trong bản ghi users nên bị xóa cùng
      await cols.users.deleteOne({ _id: userId }, { session });
    });
    return noContent();
  });
}
