// Phiên đăng nhập: mỗi refresh token gắn với một bản ghi trong collection sessions (khóa là jti),
// để thu hồi được từng phiên, xoay vòng khi refresh, và phát hiện token bị dùng lại.
import type { Collections } from '../db/client.ts';
import type { Deps } from '../deps.ts';
import type { TokenPair } from '../lib/auth.ts';
import { HttpError } from '../lib/http.ts';

/** Mọi lý do refresh thất bại đều trả cùng một lỗi, để kẻ gian không biết token đã bị phát hiện. */
const invalidToken = () => new HttpError(401, 'invalid_token', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');

type SessionDeps = Pick<Deps, 'auth' | 'cols' | 'logger'>;

/** Cấp cặp token mới và lưu phiên của refresh token. Mọi cách đăng nhập đều đi qua đây. */
export async function issueSession(deps: SessionDeps, userId: string): Promise<TokenPair> {
  const t = await deps.auth.issue(userId);
  await deps.cols.sessions.insertOne({
    _id: t.refreshJti,
    userId,
    createdAt: new Date(),
    expiresAt: t.refreshExpiresAt,
    rotatedAt: null,
  });
  return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresIn: t.expiresIn };
}

/**
 * Đổi refresh token lấy cặp token mới, đánh dấu phiên cũ đã dùng.
 * Gửi lại một token đã xoay vòng thì thu hồi mọi phiên của người dùng đó.
 */
export async function rotateSession(deps: SessionDeps, refreshToken: string): Promise<TokenPair> {
  const { userId, jti } = await deps.auth.verify(refreshToken, 'refresh');

  // Tài khoản đã xóa thì refresh token cũ (sống 30 ngày) không đổi được token mới
  const user = await deps.cols.users.findOne({ _id: userId }, { projection: { _id: 1 } });
  if (!user) throw invalidToken();

  // Lệnh nguyên tử: hai lệnh refresh song song cùng một token thì chỉ một lệnh thắng
  const claimed = await deps.cols.sessions.findOneAndUpdate(
    { _id: jti, userId, rotatedAt: null },
    { $set: { rotatedAt: new Date() } },
  );
  if (!claimed) {
    const session = await deps.cols.sessions.findOne({ _id: jti, userId }, { projection: { rotatedAt: 1 } });
    if (session?.rotatedAt) {
      await revokeAllSessions(deps.cols, userId);
      deps.logger.warn('refresh token reused, all sessions revoked', { userId });
    }
    throw invalidToken();
  }
  return issueSession(deps, userId);
}

/** Thu hồi phiên của một refresh token. Token hỏng hay phiên đã mất thì bỏ qua, để app luôn đăng xuất được. */
export async function revokeSession(deps: SessionDeps, refreshToken: string): Promise<void> {
  try {
    const { userId, jti } = await deps.auth.verify(refreshToken, 'refresh');
    await deps.cols.sessions.deleteOne({ _id: jti, userId });
  } catch (err) {
    if (!(err instanceof HttpError)) throw err;
  }
}

export async function revokeAllSessions(cols: Collections, userId: string): Promise<void> {
  await cols.sessions.deleteMany({ userId });
}
