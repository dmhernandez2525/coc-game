import { syncAchievements, getCampaignStars, withAchievementSync } from '../achievement-sync.ts';
import { createStatistics } from '../statistics-tracker.ts';
import type { GameStatistics } from '../statistics-tracker.ts';
import { getClaimableRewards } from '../achievement-manager.ts';
import type { VillageState } from '../../types/village.ts';

function statsWith(overrides: Partial<GameStatistics>): GameStatistics {
  return { ...createStatistics(), ...overrides };
}

function findValue(
  progress: ReturnType<typeof syncAchievements>,
  id: string,
): number {
  return progress.find((p) => p.achievementId === id)?.currentValue ?? -1;
}

describe('syncAchievements', () => {
  it('maps each statistic to its achievement value', () => {
    const stats = statsWith({
      totalStarsEarned: 12,
      totalDefenses: 3,
      buildingsUpgraded: 8,
      totalGoldLooted: 40_000,
      totalElixirLooted: 5_000,
      totalDarkElixirLooted: 260,
    });
    const result = syncAchievements([], { statistics: stats, trophies: 100, campaignStars: 46 });

    expect(findValue(result, 'sweet_victory')).toBe(100);
    expect(findValue(result, 'conqueror')).toBe(12);
    expect(findValue(result, 'unbreakable')).toBe(3);
    expect(findValue(result, 'empire_builder')).toBe(8);
    expect(findValue(result, 'gold_grab')).toBe(40_000);
    expect(findValue(result, 'elixir_escapade')).toBe(5_000);
    expect(findValue(result, 'heroic')).toBe(260);
    expect(findValue(result, 'get_those_goblins')).toBe(46);
  });

  it('clamps negative trophies to zero', () => {
    const result = syncAchievements([], {
      statistics: createStatistics(),
      trophies: -30,
      campaignStars: 0,
    });
    expect(findValue(result, 'sweet_victory')).toBe(0);
  });

  it('never decreases a value once recorded', () => {
    const high = syncAchievements([], {
      statistics: statsWith({ totalGoldLooted: 100_000 }),
      trophies: 0,
      campaignStars: 0,
    });
    const afterLower = syncAchievements(high, {
      statistics: statsWith({ totalGoldLooted: 10 }),
      trophies: 0,
      campaignStars: 0,
    });
    expect(findValue(afterLower, 'gold_grab')).toBe(100_000);
  });

  it('preserves claimedTier across syncs', () => {
    const first = syncAchievements([], {
      statistics: statsWith({ buildingsUpgraded: 20 }),
      trophies: 0,
      campaignStars: 0,
    }).map((p) => (p.achievementId === 'empire_builder' ? { ...p, claimedTier: 1 } : p));

    const second = syncAchievements(first, {
      statistics: statsWith({ buildingsUpgraded: 25 }),
      trophies: 0,
      campaignStars: 0,
    });
    const entry = second.find((p) => p.achievementId === 'empire_builder');
    expect(entry?.claimedTier).toBe(1);
    expect(entry?.currentValue).toBe(25);
  });

  it('makes the first tier claimable once its target is reached', () => {
    // gold_grab tier 1 target is 25_000
    const result = syncAchievements([], {
      statistics: statsWith({ totalGoldLooted: 25_000 }),
      trophies: 0,
      campaignStars: 0,
    });
    const claimable = getClaimableRewards(result).map((r) => r.achievementId);
    expect(claimable).toContain('gold_grab');
  });
});

describe('getCampaignStars', () => {
  it('reads totalStars from campaign progress', () => {
    const village = { campaignProgress: { levels: [], totalStars: 33 } } as unknown as VillageState;
    expect(getCampaignStars(village)).toBe(33);
  });

  it('returns 0 when campaign progress is missing', () => {
    const village = {} as unknown as VillageState;
    expect(getCampaignStars(village)).toBe(0);
  });
});

describe('withAchievementSync', () => {
  it('fills in fresh statistics for older saves and derives achievements', () => {
    const village = {
      trophies: 80,
      campaignProgress: { levels: [], totalStars: 0 },
    } as unknown as VillageState;
    const result = withAchievementSync(village);
    expect(result.statistics).toBeDefined();
    expect(result.statistics!.totalAttacks).toBe(0);
    expect(findValue(result.achievements ?? [], 'sweet_victory')).toBe(80);
  });
});
