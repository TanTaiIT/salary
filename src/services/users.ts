import { randomUUID } from 'node:crypto';
import { isDuplicateKey, type Collections, type UserDoc } from '../db/client.ts';

/**
 * Tìm người dùng theo nhà cung cấp và mã của họ, chưa có thì tạo với role "user".
 * Tên chỉ đặt khi tạo. Chỉ lưu tên hiển thị và mã nhà cung cấp, không lưu email.
 */
export async function findOrCreateUser(
  cols: Collections,
  provider: UserDoc['provider'],
  providerId: string,
  name: string,
): Promise<UserDoc> {
  const upsert = () => {
    const now = new Date();
    return cols.users.findOneAndUpdate(
      { provider, providerId },
      { $setOnInsert: { _id: randomUUID(), name, provider, providerId, role: 'user', firstSeenAt: now, createdAt: now } },
      { upsert: true, returnDocument: 'after' },
    );
  };
  let user: UserDoc | null;
  try {
    user = await upsert();
  } catch (err) {
    // Hai lệnh đăng nhập đầu tiên chạy cùng lúc: một lệnh đụng index unique, chạy lại sẽ tìm thấy bản vừa tạo
    if (!isDuplicateKey(err)) throw err;
    user = await upsert();
  }
  if (!user) throw new Error('Không tạo được người dùng');
  return user;
}
