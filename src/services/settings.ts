import type { UserSettingsInput } from '../schemas/index.ts';
import type { Collections, UserDoc, UserSettingsDoc } from '../db/client.ts';

export type SettingsApplyResult = { status: 'applied' | 'stale'; settings: UserSettingsDoc | null };

/**
 * Ghi cài đặt của người dùng theo nguyên tắc "bản sửa mới nhất thắng", cùng luật với ngày công:
 * bản trên server có updatedAt mới hơn hoặc bằng thì giữ bản server và trả "stale".
 * Một lệnh có điều kiện, nên hai máy ghi cùng lúc không đè nhầm bản mới hơn.
 */
export async function applySettings(
  cols: Collections,
  userId: string,
  input: UserSettingsInput,
): Promise<SettingsApplyResult> {
  const settings: UserSettingsDoc = { deductRate: input.deductRate, updatedAt: new Date(input.updatedAt) };
  // $not $gte khớp cả khi người dùng chưa có settings
  const res = await cols.users.updateOne(
    { _id: userId, 'settings.updatedAt': { $not: { $gte: settings.updatedAt } } },
    { $set: { settings } },
  );
  if (res.matchedCount === 1) return { status: 'applied', settings };

  const user = await cols.users.findOne({ _id: userId }, { projection: { settings: 1 } });
  return { status: 'stale', settings: user?.settings ?? null };
}

export function settingsToApi(s: UserSettingsDoc | null | undefined) {
  return s ? { deductRate: s.deductRate, updatedAt: s.updatedAt.toISOString() } : null;
}

export function meToApi(user: UserDoc) {
  const firstSeen = user.firstSeenAt ?? user.createdAt;
  return {
    id: user._id,
    name: user.name,
    provider: user.provider,
    firstOpenAt: firstSeen.toISOString(),
    settings: settingsToApi(user.settings),
  };
}
