// Cấp hoặc thu quyền admin: pnpm set-role <provider> <providerId> <admin|user>
// Ví dụ: pnpm set-role dev tai admin
import { loadConfig } from '../src/config.ts';
import { connectMongo, getCollections } from '../src/db/client.ts';

const [provider, providerId, role] = process.argv.slice(2);
if (!provider || !providerId || (role !== 'admin' && role !== 'user')) {
  console.error('Cách dùng: pnpm set-role <provider> <providerId> <admin|user>');
  process.exit(1);
}

const config = loadConfig();
const { client, db } = await connectMongo(config.mongo.uri, config.mongo.db);
const res = await getCollections(db).users.updateOne(
  { provider: provider as 'dev' | 'apple' | 'google' | 'kakao', providerId },
  { $set: { role } },
);
console.log(res.matchedCount ? `Đã đặt role = ${role}` : 'Không tìm thấy người dùng');
await client.close();
process.exit(res.matchedCount ? 0 : 1);
