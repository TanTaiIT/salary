// Ghi cấu hình app (quảng cáo, phiên bản tối thiểu) vào appConfig/current. Chạy lại nhiều lần vẫn cùng kết quả.
// Sửa giá trị dưới đây rồi chạy: pnpm seed:config
import { loadConfig } from '../src/config.ts';
import { connectMongo, getCollections } from '../src/db/client.ts';
import { AppConfig } from '../src/schemas/index.ts';

const value = AppConfig.parse({
  ads: {
    enabled: true,
    tiers: [
      { tier: 1, minDays: 0, minActiveDays: 0, placements: ['stats_bottom', 'history_bottom', 'settings_bottom'] },
      { tier: 2, minDays: 90, minActiveDays: 30, placements: ['home_overview', 'history_native', 'rewarded_unlock'] },
      { tier: 3, minDays: 180, minActiveDays: 60, placements: ['stats_interstitial'], enabled: false },
    ],
    caps: { interstitialPerDay: 1, nativeEvery: 10 },
  },
  minAppVersion: '1.0.0',
});

const config = loadConfig();
const { client, db } = await connectMongo(config.mongo.uri, config.mongo.db);
await getCollections(db).appConfig.replaceOne(
  { _id: 'current' },
  { ...value, updatedAt: new Date() },
  { upsert: true },
);
console.log('Đã ghi cấu hình app');
await client.close();
