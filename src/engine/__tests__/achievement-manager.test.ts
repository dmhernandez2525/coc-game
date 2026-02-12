import type { AchievementProgress } from '../achievement-manager.ts';
import {
  ACHIEVEMENTS,
  getAchievement,
  updateAchievementProgress,
  getClaimableRewards,
  claimReward,
  getTotalGemsEarned,
} from '../achievement-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProgress(overrides?: Partial<AchievementProgress>): AchievementProgress {
  return {
    achievementId: 'sweet_victory',
    currentValue: 0,
    claimedTier: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ACHIEVEMENTS constant
// ---------------------------------------------------------------------------
describe('ACHIEVEMENTS constant', () => {
  it('contains at least 8 achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(8);
  });

  it('has unique ids across all achievements', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('includes all four categories', () => {
    const categories = new Set(ACHIEVEMENTS.map((a) => a.category));

    expect(categories.has('combat')).toBe(true);
    expect(categories.has('resource')).toBe(true);
    expect(categories.has('building')).toBe(true);
    expect(categories.has('campaign')).toBe(true);
  });

  it('has at least one tier per achievement', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.tiers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('has ascending tier targets within each achievement', () => {
    for (const achievement of ACHIEVEMENTS) {
      for (let i = 1; i < achievement.tiers.length; i++) {
        expect(achievement.tiers[i]!.target).toBeGreaterThan(
          achievement.tiers[i - 1]!.target,
        );
      }
    }
  });

  it('has positive gem rewards for every tier', () => {
    for (const achievement of ACHIEVEMENTS) {
      for (const tier of achievement.tiers) {
        expect(tier.gemReward).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getAchievement
// ---------------------------------------------------------------------------
describe('getAchievement', () => {
  it('returns the correct achievement for a known id', () => {
    const result = getAchievement('sweet_victory');

    expect(result).toBeDefined();
    expect(result!.id).toBe('sweet_victory');
    expect(result!.name).toBe('Sweet Victory');
    expect(result!.category).toBe('combat');
  });

  it('returns undefined for an unknown id', () => {
    const result = getAchievement('nonexistent_achievement');

    expect(result).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    const result = getAchievement('');

    expect(result).toBeUndefined();
  });

  it('returns the full tier data for empire_builder', () => {
    const result = getAchievement('empire_builder');

    expect(result).toBeDefined();
    expect(result!.tiers).toHaveLength(3);
    expect(result!.tiers[0]).toEqual({ target: 20, gemReward: 5 });
    expect(result!.tiers[1]).toEqual({ target: 100, gemReward: 10 });
    expect(result!.tiers[2]).toEqual({ target: 500, gemReward: 250 });
  });

  it('can retrieve every achievement by its id', () => {
    for (const achievement of ACHIEVEMENTS) {
      const result = getAchievement(achievement.id);
      expect(result).toBe(achievement);
    }
  });
});

// ---------------------------------------------------------------------------
// updateAchievementProgress
// ---------------------------------------------------------------------------
describe('updateAchievementProgress', () => {
  it('creates a new entry when no progress exists for the achievement', () => {
    const progress: AchievementProgress[] = [];
    const result = updateAchievementProgress(progress, 'sweet_victory', 50);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      achievementId: 'sweet_victory',
      currentValue: 50,
      claimedTier: 0,
    });
  });

  it('initializes claimedTier to 0 for new entries', () => {
    const result = updateAchievementProgress([], 'gold_grab', 1000);

    expect(result[0]!.claimedTier).toBe(0);
  });

  it('increases the value when newValue is higher', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 30 })];
    const result = updateAchievementProgress(progress, 'sweet_victory', 80);

    expect(result[0]!.currentValue).toBe(80);
  });

  it('does not decrease the value when newValue is lower', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 100 })];
    const result = updateAchievementProgress(progress, 'sweet_victory', 50);

    expect(result).toBe(progress);
    expect(result[0]!.currentValue).toBe(100);
  });

  it('returns the same array reference when the value is equal', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 75 })];
    const result = updateAchievementProgress(progress, 'sweet_victory', 75);

    expect(result).toBe(progress);
  });

  it('does not mutate the original progress array', () => {
    const original = [makeProgress({ achievementId: 'sweet_victory', currentValue: 10 })];
    const originalCopy = JSON.parse(JSON.stringify(original));

    updateAchievementProgress(original, 'sweet_victory', 100);

    expect(original).toEqual(originalCopy);
  });

  it('does not mutate the original entry object when updating', () => {
    const entry = makeProgress({ achievementId: 'sweet_victory', currentValue: 10 });
    const progress = [entry];

    updateAchievementProgress(progress, 'sweet_victory', 200);

    expect(entry.currentValue).toBe(10);
  });

  it('preserves existing entries when adding a new achievement', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 100 }),
    ];
    const result = updateAchievementProgress(progress, 'gold_grab', 5000);

    expect(result).toHaveLength(2);
    expect(result[0]!.achievementId).toBe('sweet_victory');
    expect(result[0]!.currentValue).toBe(100);
    expect(result[1]!.achievementId).toBe('gold_grab');
    expect(result[1]!.currentValue).toBe(5000);
  });

  it('preserves claimedTier when updating currentValue', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 100, claimedTier: 1 }),
    ];
    const result = updateAchievementProgress(progress, 'sweet_victory', 800);

    expect(result[0]!.claimedTier).toBe(1);
    expect(result[0]!.currentValue).toBe(800);
  });

  it('handles updating progress for an id not in ACHIEVEMENTS', () => {
    const result = updateAchievementProgress([], 'fake_achievement', 999);

    expect(result).toHaveLength(1);
    expect(result[0]!.achievementId).toBe('fake_achievement');
    expect(result[0]!.currentValue).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// getClaimableRewards
// ---------------------------------------------------------------------------
describe('getClaimableRewards', () => {
  it('returns an empty array when progress is empty', () => {
    const result = getClaimableRewards([]);

    expect(result).toEqual([]);
  });

  it('returns no rewards when value is below the first tier target', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 10 })];
    const result = getClaimableRewards(progress);

    expect(result).toEqual([]);
  });

  it('returns tier 0 reward when value meets the first tier target', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 75 })];
    const result = getClaimableRewards(progress);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      achievementId: 'sweet_victory',
      tierIndex: 0,
      gemReward: 5,
    });
  });

  it('returns multiple tiers when value exceeds several targets', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 1300 })];
    const result = getClaimableRewards(progress);

    // Value of 1300 exceeds tier 0 (75), tier 1 (750), and tier 2 (1250)
    expect(result).toHaveLength(3);
    expect(result[0]!.tierIndex).toBe(0);
    expect(result[1]!.tierIndex).toBe(1);
    expect(result[2]!.tierIndex).toBe(2);
  });

  it('skips already claimed tiers', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 1300, claimedTier: 1 }),
    ];
    const result = getClaimableRewards(progress);

    // Tier 0 is claimed. Tiers 1 and 2 are claimable.
    expect(result).toHaveLength(2);
    expect(result[0]!.tierIndex).toBe(1);
    expect(result[1]!.tierIndex).toBe(2);
  });

  it('returns nothing when all reachable tiers are already claimed', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 1300, claimedTier: 3 }),
    ];
    const result = getClaimableRewards(progress);

    expect(result).toEqual([]);
  });

  it('stops at the first tier whose target is not met', () => {
    // sweet_victory tiers: 75, 750, 1250
    // Value 100 meets tier 0 (75) but not tier 1 (750)
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 100 })];
    const result = getClaimableRewards(progress);

    expect(result).toHaveLength(1);
    expect(result[0]!.tierIndex).toBe(0);
  });

  it('handles multiple achievements with claimable rewards', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 80 }),
      makeProgress({ achievementId: 'empire_builder', currentValue: 25, claimedTier: 0 }),
    ];
    const result = getClaimableRewards(progress);

    expect(result).toHaveLength(2);
    expect(result[0]!.achievementId).toBe('sweet_victory');
    expect(result[1]!.achievementId).toBe('empire_builder');
  });

  it('skips entries with unknown achievement ids', () => {
    const progress = [
      makeProgress({ achievementId: 'does_not_exist', currentValue: 99999 }),
    ];
    const result = getClaimableRewards(progress);

    expect(result).toEqual([]);
  });

  it('returns correct gem rewards for each tier', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 800 }),
    ];
    const result = getClaimableRewards(progress);

    // Tiers 0 and 1 are claimable (75, 750). Tier 2 target (1250) not met.
    expect(result).toHaveLength(2);
    expect(result[0]!.gemReward).toBe(5);
    expect(result[1]!.gemReward).toBe(10);
  });

  it('returns value exactly at tier target as claimable', () => {
    const progress = [
      makeProgress({ achievementId: 'unbreakable', currentValue: 10 }),
    ];
    const result = getClaimableRewards(progress);

    expect(result).toHaveLength(1);
    expect(result[0]!.gemReward).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// claimReward
// ---------------------------------------------------------------------------
describe('claimReward', () => {
  it('claims the first tier and returns correct gems', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 100 })];
    const result = claimReward(progress, 'sweet_victory');

    expect(result.gemsEarned).toBe(5);
    expect(result.progress[0]!.claimedTier).toBe(1);
  });

  it('claims only one tier per call', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 1300 })];
    const first = claimReward(progress, 'sweet_victory');

    expect(first.gemsEarned).toBe(5);
    expect(first.progress[0]!.claimedTier).toBe(1);

    const second = claimReward(first.progress, 'sweet_victory');

    expect(second.gemsEarned).toBe(10);
    expect(second.progress[0]!.claimedTier).toBe(2);

    const third = claimReward(second.progress, 'sweet_victory');

    expect(third.gemsEarned).toBe(450);
    expect(third.progress[0]!.claimedTier).toBe(3);
  });

  it('returns 0 gems when no progress entry exists', () => {
    const result = claimReward([], 'sweet_victory');

    expect(result.gemsEarned).toBe(0);
    expect(result.progress).toEqual([]);
  });

  it('returns 0 gems for an unknown achievement id in progress', () => {
    const progress = [makeProgress({ achievementId: 'fake_id', currentValue: 99999 })];
    const result = claimReward(progress, 'fake_id');

    expect(result.gemsEarned).toBe(0);
    expect(result.progress).toBe(progress);
  });

  it('returns 0 gems when value has not reached the next tier target', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 50 })];
    const result = claimReward(progress, 'sweet_victory');

    expect(result.gemsEarned).toBe(0);
    expect(result.progress).toBe(progress);
  });

  it('returns 0 gems when all tiers are already claimed', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 2000, claimedTier: 3 }),
    ];
    const result = claimReward(progress, 'sweet_victory');

    expect(result.gemsEarned).toBe(0);
    expect(result.progress).toBe(progress);
  });

  it('does not mutate the original progress array', () => {
    const entry = makeProgress({ achievementId: 'sweet_victory', currentValue: 100 });
    const progress = [entry];
    const progressCopy = JSON.parse(JSON.stringify(progress));

    claimReward(progress, 'sweet_victory');

    expect(progress).toEqual(progressCopy);
  });

  it('does not mutate the original entry object', () => {
    const entry = makeProgress({ achievementId: 'sweet_victory', currentValue: 100 });
    const progress = [entry];

    claimReward(progress, 'sweet_victory');

    expect(entry.claimedTier).toBe(0);
  });

  it('preserves other achievement entries when claiming', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 100 }),
      makeProgress({ achievementId: 'empire_builder', currentValue: 50 }),
    ];
    const result = claimReward(progress, 'sweet_victory');

    expect(result.progress).toHaveLength(2);
    expect(result.progress[1]!.achievementId).toBe('empire_builder');
    expect(result.progress[1]!.currentValue).toBe(50);
    expect(result.progress[1]!.claimedTier).toBe(0);
  });

  it('returns original array reference when claiming for non-existent progress entry', () => {
    const progress = [makeProgress({ achievementId: 'sweet_victory', currentValue: 100 })];
    const result = claimReward(progress, 'empire_builder');

    expect(result.progress).toBe(progress);
  });
});

// ---------------------------------------------------------------------------
// getTotalGemsEarned
// ---------------------------------------------------------------------------
describe('getTotalGemsEarned', () => {
  it('returns 0 for empty progress', () => {
    const result = getTotalGemsEarned([]);

    expect(result).toBe(0);
  });

  it('returns 0 when no tiers have been claimed', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 1000, claimedTier: 0 }),
    ];
    const result = getTotalGemsEarned(progress);

    expect(result).toBe(0);
  });

  it('returns correct gems for one claimed tier', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 100, claimedTier: 1 }),
    ];
    const result = getTotalGemsEarned(progress);

    // sweet_victory tier 0 reward: 5
    expect(result).toBe(5);
  });

  it('returns correct gems for two claimed tiers', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 800, claimedTier: 2 }),
    ];
    const result = getTotalGemsEarned(progress);

    // sweet_victory tier 0 (5) + tier 1 (10) = 15
    expect(result).toBe(15);
  });

  it('returns correct gems for all three claimed tiers', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 2000, claimedTier: 3 }),
    ];
    const result = getTotalGemsEarned(progress);

    // sweet_victory: 5 + 10 + 450 = 465
    expect(result).toBe(465);
  });

  it('sums gems across multiple achievements', () => {
    const progress = [
      makeProgress({ achievementId: 'sweet_victory', currentValue: 100, claimedTier: 1 }),
      makeProgress({ achievementId: 'empire_builder', currentValue: 200, claimedTier: 2 }),
    ];
    const result = getTotalGemsEarned(progress);

    // sweet_victory tier 0: 5
    // empire_builder tier 0 (5) + tier 1 (10): 15
    // Total: 20
    expect(result).toBe(20);
  });

  it('ignores progress entries with unknown achievement ids', () => {
    const progress = [
      makeProgress({ achievementId: 'nonexistent', currentValue: 999, claimedTier: 2 }),
      makeProgress({ achievementId: 'sweet_victory', currentValue: 100, claimedTier: 1 }),
    ];
    const result = getTotalGemsEarned(progress);

    expect(result).toBe(5);
  });

  it('handles a full claim scenario across all achievements', () => {
    const progress = ACHIEVEMENTS.map((a) => ({
      achievementId: a.id,
      currentValue: a.tiers[a.tiers.length - 1]!.target + 1,
      claimedTier: a.tiers.length,
    }));

    const expectedTotal = ACHIEVEMENTS.reduce(
      (sum, a) => sum + a.tiers.reduce((s, t) => s + t.gemReward, 0),
      0,
    );
    const result = getTotalGemsEarned(progress);

    expect(result).toBe(expectedTotal);
  });
});

// ---------------------------------------------------------------------------
// Integration: full workflow
// ---------------------------------------------------------------------------
describe('full achievement workflow', () => {
  it('tracks progress, claims rewards, and tallies gems end to end', () => {
    let progress: AchievementProgress[] = [];

    // Step 1: Earn 80 trophies (meets sweet_victory tier 0 target of 75)
    progress = updateAchievementProgress(progress, 'sweet_victory', 80);
    expect(progress).toHaveLength(1);

    // Step 2: Verify tier 0 is claimable
    let claimable = getClaimableRewards(progress);
    expect(claimable).toHaveLength(1);
    expect(claimable[0]!.tierIndex).toBe(0);

    // Step 3: Claim tier 0
    let claimResult = claimReward(progress, 'sweet_victory');
    expect(claimResult.gemsEarned).toBe(5);
    progress = claimResult.progress;

    // Step 4: No more claimable rewards
    claimable = getClaimableRewards(progress);
    expect(claimable).toEqual([]);

    // Step 5: Progress to 800 (meets tier 1 target of 750)
    progress = updateAchievementProgress(progress, 'sweet_victory', 800);

    // Step 6: Claim tier 1
    claimResult = claimReward(progress, 'sweet_victory');
    expect(claimResult.gemsEarned).toBe(10);
    progress = claimResult.progress;

    // Step 7: Check total gems earned so far
    expect(getTotalGemsEarned(progress)).toBe(15);

    // Step 8: Add a second achievement
    progress = updateAchievementProgress(progress, 'conqueror', 500);

    // Step 9: Conqueror should have all 3 tiers claimable (10, 75, 500)
    claimable = getClaimableRewards(progress);
    const conquerorRewards = claimable.filter((r) => r.achievementId === 'conqueror');
    expect(conquerorRewards).toHaveLength(3);

    // Step 10: Claim all conqueror tiers one by one
    for (let i = 0; i < 3; i++) {
      claimResult = claimReward(progress, 'conqueror');
      expect(claimResult.gemsEarned).toBeGreaterThan(0);
      progress = claimResult.progress;
    }

    // Step 11: Total gems: sweet_victory (5 + 10) + conqueror (5 + 10 + 250) = 280
    expect(getTotalGemsEarned(progress)).toBe(280);
  });
});
