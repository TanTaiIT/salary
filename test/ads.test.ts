import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdConfig, DEFAULT_AD_CONFIG, adTier, type AdConfig as AdConfigT } from '../src/schemas/index.ts';

const cfg: AdConfigT = structuredClone(DEFAULT_AD_CONFIG);
const tier1 = ['stats_bottom', 'history_bottom', 'settings_bottom'];
const tier2 = [...tier1, 'home_overview', 'history_native', 'rewarded_unlock'];

test('adTier: ngày đầu tiên là cấp 1, chỉ banner ở màn phụ', () => {
  assert.deepEqual(adTier({ daysSinceFirstOpen: 0, activeDays: 0 }, cfg), { tier: 1, placements: tier1 });
});

test('adTier: ngày 89 vẫn là cấp 1 dù đủ ngày chấm công', () => {
  assert.equal(adTier({ daysSinceFirstOpen: 89, activeDays: 50 }, cfg).tier, 1);
});

test('adTier: ngày 90 nhưng mới 29 ngày chấm công vẫn là cấp 1', () => {
  assert.equal(adTier({ daysSinceFirstOpen: 90, activeDays: 29 }, cfg).tier, 1);
});

test('adTier: ngày 90 và 30 ngày chấm công lên cấp 2, cộng dồn vị trí cấp 1', () => {
  assert.deepEqual(adTier({ daysSinceFirstOpen: 90, activeDays: 30 }, cfg), { tier: 2, placements: tier2 });
});

test('adTier: cấp 3 đang tắt thì dừng ở cấp 2', () => {
  assert.equal(adTier({ daysSinceFirstOpen: 400, activeDays: 300 }, cfg).tier, 2);
});

test('adTier: bật cấp 3 thì ngày 180 và 60 ngày chấm công lên cấp 3', () => {
  const on = structuredClone(cfg);
  on.tiers[2]!.enabled = true;
  const r = adTier({ daysSinceFirstOpen: 180, activeDays: 60 }, on);
  assert.equal(r.tier, 3);
  assert.ok(r.placements.includes('stats_interstitial'));
  assert.equal(adTier({ daysSinceFirstOpen: 179, activeDays: 60 }, on).tier, 2);
});

test('adTier: tắt toàn bộ quảng cáo trả cấp 0', () => {
  assert.deepEqual(adTier({ daysSinceFirstOpen: 400, activeDays: 300 }, { ...cfg, enabled: false }), {
    tier: 0,
    placements: [],
  });
});

test('AdConfig: nhận đúng JSON mẫu trong spec, enabled mặc định true', () => {
  const parsed = AdConfig.parse({
    enabled: true,
    tiers: [
      { tier: 1, minDays: 0, minActiveDays: 0, placements: ['stats_bottom'] },
      { tier: 3, minDays: 180, minActiveDays: 60, placements: ['stats_interstitial'], enabled: false },
    ],
    caps: { interstitialPerDay: 1, nativeEvery: 10 },
  });
  assert.equal(parsed.tiers[0]!.enabled, true);
  assert.equal(parsed.tiers[1]!.enabled, false);
});

test('AdConfig: từ chối mã vị trí lạ', () => {
  const r = AdConfig.safeParse({
    enabled: true,
    tiers: [{ tier: 1, minDays: 0, minActiveDays: 0, placements: ['popup_khi_cham_cong'] }],
    caps: { interstitialPerDay: 1, nativeEvery: 10 },
  });
  assert.equal(r.success, false);
});
