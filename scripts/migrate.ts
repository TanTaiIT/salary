// Bổ sung các trường mới cho dữ liệu tạo trước khi có đồng bộ nơi làm việc, quyền admin và firstSeenAt.
// Chạy lại nhiều lần vẫn an toàn: chỉ sửa bản ghi còn thiếu trường. Chạy: pnpm migrate
import { loadConfig } from '../src/config.ts';
import { connectMongo, getCollections, type Collections } from '../src/db/client.ts';

export interface MigrateReport {
  serverUpdatedAt: { jobs: number; workDays: number; weeklyHolidayPays: number };
  deletedAt: { jobs: number; workDays: number; weeklyHolidayPays: number };
  userRole: number;
  userFirstSeenAt: number;
}

export async function migrate(cols: Collections, now = new Date()): Promise<MigrateReport> {
  const synced = ['jobs', 'workDays', 'weeklyHolidayPays'] as const;
  const report: MigrateReport = {
    serverUpdatedAt: { jobs: 0, workDays: 0, weeklyHolidayPays: 0 },
    deletedAt: { jobs: 0, workDays: 0, weeklyHolidayPays: 0 },
    userRole: 0,
    userFirstSeenAt: 0,
  };

  for (const name of synced) {
    // Collection có kiểu khác nhau nhưng cùng hai trường này; ép kiểu chung để dùng một vòng lặp
    const col = cols[name] as unknown as Collections['jobs'];
    // Dùng thời điểm chạy script, không dùng updatedAt: mốc since của các máy đã đồng bộ trước đây
    // đều muộn hơn updatedAt cũ, nên gán updatedAt thì các máy đó không bao giờ kéo được bản này
    const a = await col.updateMany({ serverUpdatedAt: { $exists: false } }, { $set: { serverUpdatedAt: now } });
    report.serverUpdatedAt[name] = a.modifiedCount;
    // Thiếu deletedAt thì index unique một phần ({ deletedAt: { $type: 'null' } }) bỏ qua bản ghi
    const b = await col.updateMany({ deletedAt: { $exists: false } }, { $set: { deletedAt: null } });
    report.deletedAt[name] = b.modifiedCount;
  }

  report.userRole = (await cols.users.updateMany({ role: { $exists: false } }, { $set: { role: 'user' } }))
    .modifiedCount;
  report.userFirstSeenAt = (
    await cols.users.updateMany({ firstSeenAt: { $exists: false } }, [{ $set: { firstSeenAt: '$createdAt' } }])
  ).modifiedCount;
  return report;
}

if (import.meta.main) {
  const config = loadConfig();
  const { client, db } = await connectMongo(config.mongo.uri, config.mongo.db);
  try {
    console.log(JSON.stringify(await migrate(getCollections(db)), null, 2));
  } finally {
    await client.close();
  }
}
