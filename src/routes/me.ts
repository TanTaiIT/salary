import { noContent } from '../lib/http.ts';
import type { Router } from '../lib/router.ts';

export function meRoutes(r: Router): void {
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
      await cols.users.deleteOne({ _id: userId }, { session });
    });
    return noContent();
  });
}
