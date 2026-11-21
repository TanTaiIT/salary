// Kết nối MongoDB thật cho test tích hợp. Mỗi file test dùng một database riêng và xóa khi xong.
// Không kết nối được (ví dụ chưa chạy `docker compose up -d`) thì các test tích hợp tự bỏ qua.
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { ensureIndexes, getCollections, transactionRunner, type Collections, type WithTransaction } from '../src/db/client.ts';

const uri = process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true';

export interface TestDb {
  cols: Collections;
  withTransaction: WithTransaction;
  close(): Promise<void>;
}

/** Trả về null khi không kết nối được, để test gọi `describe(..., { skip })`. */
export async function openTestDb(): Promise<TestDb | null> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2_000, appName: 'llhq-test' });
  try {
    await client.connect();
  } catch (err) {
    await client.close().catch(() => {});
    // Trên CI không được lặng lẽ bỏ qua test tích hợp
    if (process.env.REQUIRE_MONGO === '1') throw new Error(`REQUIRE_MONGO=1 nhưng không kết nối được ${uri}`, { cause: err });
    return null;
  }
  const db = client.db(`llhq_test_${randomUUID().slice(0, 8)}`);
  const cols = getCollections(db);
  await ensureIndexes(cols);
  return {
    cols,
    withTransaction: transactionRunner(client),
    async close() {
      await db.dropDatabase();
      await client.close();
    },
  };
}

export const SKIP_REASON = `Không kết nối được MongoDB (${uri}); chạy \`docker compose up -d\` để bật test tích hợp`;
