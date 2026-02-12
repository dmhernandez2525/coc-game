import type { CampaignProgress, CampaignLevelProgress } from '../../types/village.ts';
import {
  getCampaignLevels,
  getCampaignLevel,
  isLevelUnlocked,
  getLevelProgress,
  completeCampaignLevel,
  getStarRewards,
  getTotalLootAvailable,
  getNextUncompletedLevel,
} from '../campaign-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProgress(
  levels: CampaignLevelProgress[] = [],
  totalStars?: number,
): CampaignProgress {
  const computed = totalStars ?? levels.reduce((sum, l) => sum + l.stars, 0);
  return { levels, totalStars: computed };
}

// ---------------------------------------------------------------------------
// getCampaignLevels
// ---------------------------------------------------------------------------

describe('getCampaignLevels', () => {
  it('returns exactly 90 levels', () => {
    const levels = getCampaignLevels();
    expect(levels).toHaveLength(90);
  });

  it('has "Payback" as the first level', () => {
    const levels = getCampaignLevels();
    expect(levels[0].name).toBe('Payback');
    expect(levels[0].level).toBe(1);
  });

  it('has level 90 as the last level', () => {
    const levels = getCampaignLevels();
    const last = levels[levels.length - 1];
    expect(last.level).toBe(90);
    expect(last.name).toBe("M.O.M.M.A's Madhouse");
  });

  it('every level has goldLoot, elixirLoot, and darkElixirLoot fields', () => {
    const levels = getCampaignLevels();
    for (const level of levels) {
      expect(level).toHaveProperty('goldLoot');
      expect(level).toHaveProperty('elixirLoot');
      expect(level).toHaveProperty('darkElixirLoot');
      expect(typeof level.goldLoot).toBe('number');
      expect(typeof level.elixirLoot).toBe('number');
      expect(typeof level.darkElixirLoot).toBe('number');
    }
  });

  it('all levels have maxStars of 3', () => {
    const levels = getCampaignLevels();
    for (const level of levels) {
      expect(level.maxStars).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// getCampaignLevel
// ---------------------------------------------------------------------------

describe('getCampaignLevel', () => {
  it('returns the correct level by number', () => {
    const level = getCampaignLevel(1);
    expect(level).toBeDefined();
    expect(level!.name).toBe('Payback');
    expect(level!.goldLoot).toBe(500);
    expect(level!.elixirLoot).toBe(500);
  });

  it('returns undefined for level 0', () => {
    expect(getCampaignLevel(0)).toBeUndefined();
  });

  it('returns undefined for level 91', () => {
    expect(getCampaignLevel(91)).toBeUndefined();
  });

  it('returns undefined for negative level numbers', () => {
    expect(getCampaignLevel(-1)).toBeUndefined();
  });

  it('returns the last level correctly', () => {
    const level = getCampaignLevel(90);
    expect(level).toBeDefined();
    expect(level!.name).toBe("M.O.M.M.A's Madhouse");
  });
});

// ---------------------------------------------------------------------------
// isLevelUnlocked
// ---------------------------------------------------------------------------

describe('isLevelUnlocked', () => {
  it('level 1 is always unlocked, even with empty progress', () => {
    const progress = makeProgress();
    expect(isLevelUnlocked(1, progress)).toBe(true);
  });

  it('level 2 is locked when level 1 is not completed', () => {
    const progress = makeProgress();
    expect(isLevelUnlocked(2, progress)).toBe(false);
  });

  it('level 2 is unlocked when level 1 is completed', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
    ]);
    expect(isLevelUnlocked(2, progress)).toBe(true);
  });

  it('level 3 is locked when only level 1 is completed (level 2 missing)', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
    ]);
    expect(isLevelUnlocked(3, progress)).toBe(false);
  });

  it('level N+1 is unlocked when level N is completed', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
      { levelNumber: 2, stars: 2, completed: true },
      { levelNumber: 3, stars: 1, completed: true },
    ]);
    expect(isLevelUnlocked(4, progress)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getLevelProgress
// ---------------------------------------------------------------------------

describe('getLevelProgress', () => {
  it('returns progress for a completed level', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
    ]);
    const result = getLevelProgress(1, progress);
    expect(result).toBeDefined();
    expect(result!.stars).toBe(3);
    expect(result!.completed).toBe(true);
  });

  it('returns undefined for a level with no progress', () => {
    const progress = makeProgress();
    expect(getLevelProgress(1, progress)).toBeUndefined();
  });

  it('returns the correct entry when multiple levels have progress', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
      { levelNumber: 2, stars: 1, completed: true },
      { levelNumber: 3, stars: 2, completed: true },
    ]);
    const result = getLevelProgress(2, progress);
    expect(result).toBeDefined();
    expect(result!.stars).toBe(1);
    expect(result!.levelNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// completeCampaignLevel
// ---------------------------------------------------------------------------

describe('completeCampaignLevel', () => {
  it('adds a new progress entry for a fresh level', () => {
    const progress = makeProgress();
    const result = completeCampaignLevel(progress, 1, 3);
    expect(result.levels).toHaveLength(1);
    expect(result.levels[0]).toEqual({
      levelNumber: 1,
      stars: 3,
      completed: true,
    });
  });

  it('updates totalStars after completing a level', () => {
    const progress = makeProgress();
    const result = completeCampaignLevel(progress, 1, 2);
    expect(result.totalStars).toBe(2);
  });

  it('only updates if the new star count is higher', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
    ]);
    const result = completeCampaignLevel(progress, 1, 2);
    // Should return the same object since stars are not higher
    expect(result).toBe(progress);
    expect(result.levels[0].stars).toBe(3);
  });

  it('returns unchanged progress when stars are equal', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 2, completed: true },
    ]);
    const result = completeCampaignLevel(progress, 1, 2);
    expect(result).toBe(progress);
  });

  it('updates stars when the new count is strictly higher', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 1, completed: true },
    ]);
    const result = completeCampaignLevel(progress, 1, 3);
    expect(result.levels[0].stars).toBe(3);
    expect(result.totalStars).toBe(3);
  });

  it('clamps stars to a maximum of 3', () => {
    const progress = makeProgress();
    const result = completeCampaignLevel(progress, 1, 5);
    expect(result.levels[0].stars).toBe(3);
  });

  it('clamps negative stars to 0', () => {
    const progress = makeProgress();
    const result = completeCampaignLevel(progress, 1, -2);
    expect(result.levels[0].stars).toBe(0);
  });

  it('marks level as not completed when clamped to 0 stars', () => {
    const progress = makeProgress();
    const result = completeCampaignLevel(progress, 1, 0);
    expect(result.levels[0].completed).toBe(false);
  });

  it('does not mutate the input progress object', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 1, completed: true },
    ]);
    const originalLevels = [...progress.levels];
    completeCampaignLevel(progress, 1, 3);
    expect(progress.levels).toEqual(originalLevels);
    expect(progress.levels).toHaveLength(1);
    expect(progress.levels[0].stars).toBe(1);
  });

  it('does not mutate the input when adding a new level entry', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
    ]);
    const originalLength = progress.levels.length;
    completeCampaignLevel(progress, 2, 2);
    expect(progress.levels).toHaveLength(originalLength);
  });

  it('recalculates totalStars across all levels correctly', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
      { levelNumber: 2, stars: 2, completed: true },
    ]);
    const result = completeCampaignLevel(progress, 3, 1);
    expect(result.totalStars).toBe(6); // 3 + 2 + 1
  });
});

// ---------------------------------------------------------------------------
// getStarRewards
// ---------------------------------------------------------------------------

describe('getStarRewards', () => {
  it('returns 3 reward tiers', () => {
    const progress = makeProgress();
    const rewards = getStarRewards(progress);
    expect(rewards).toHaveLength(3);
  });

  it('marks no tiers as claimed with 0 stars', () => {
    const progress = makeProgress([], 0);
    const rewards = getStarRewards(progress);
    expect(rewards.every((r) => r.claimed === false)).toBe(true);
  });

  it('marks the first tier as claimed when totalStars reaches 150', () => {
    const progress = makeProgress([], 150);
    const rewards = getStarRewards(progress);
    expect(rewards[0].claimed).toBe(true);
    expect(rewards[1].claimed).toBe(false);
    expect(rewards[2].claimed).toBe(false);
  });

  it('marks the first two tiers as claimed at 225 stars', () => {
    const progress = makeProgress([], 225);
    const rewards = getStarRewards(progress);
    expect(rewards[0].claimed).toBe(true);
    expect(rewards[1].claimed).toBe(true);
    expect(rewards[2].claimed).toBe(false);
  });

  it('marks all tiers as claimed at 270 stars (max)', () => {
    const progress = makeProgress([], 270);
    const rewards = getStarRewards(progress);
    expect(rewards.every((r) => r.claimed)).toBe(true);
  });

  it('includes correct gem values for each tier', () => {
    const progress = makeProgress([], 0);
    const rewards = getStarRewards(progress);
    expect(rewards[0]).toMatchObject({ stars: 150, gems: 35 });
    expect(rewards[1]).toMatchObject({ stars: 225, gems: 170 });
    expect(rewards[2]).toMatchObject({ stars: 270, gems: 350 });
  });
});

// ---------------------------------------------------------------------------
// getTotalLootAvailable
// ---------------------------------------------------------------------------

describe('getTotalLootAvailable', () => {
  it('returns zeroes when no levels are completed', () => {
    const progress = makeProgress();
    const loot = getTotalLootAvailable(progress);
    expect(loot).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });

  it('sums loot from a single completed level', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
    ]);
    const loot = getTotalLootAvailable(progress);
    expect(loot.gold).toBe(500);
    expect(loot.elixir).toBe(500);
    expect(loot.darkElixir).toBe(0);
  });

  it('sums loot from multiple completed levels', () => {
    // Level 1: 500 gold, 500 elixir, 0 dark
    // Level 90: 2,500,000 gold, 2,500,000 elixir, 25,000 dark
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
      { levelNumber: 90, stars: 1, completed: true },
    ]);
    const loot = getTotalLootAvailable(progress);
    expect(loot.gold).toBe(2_500_500);
    expect(loot.elixir).toBe(2_500_500);
    expect(loot.darkElixir).toBe(25_000);
  });

  it('excludes levels with 0 stars', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 0, completed: false },
    ]);
    const loot = getTotalLootAvailable(progress);
    expect(loot).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });

  it('ignores progress entries for non-existent levels', () => {
    const progress = makeProgress([
      { levelNumber: 999, stars: 3, completed: true },
    ]);
    const loot = getTotalLootAvailable(progress);
    expect(loot).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });
});

// ---------------------------------------------------------------------------
// getNextUncompletedLevel
// ---------------------------------------------------------------------------

describe('getNextUncompletedLevel', () => {
  it('returns level 1 when no levels have been completed', () => {
    const progress = makeProgress();
    expect(getNextUncompletedLevel(progress)).toBe(1);
  });

  it('returns the first level that has no progress entry', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
    ]);
    expect(getNextUncompletedLevel(progress)).toBe(2);
  });

  it('returns level with 0 stars as uncompleted', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 0, completed: false },
    ]);
    expect(getNextUncompletedLevel(progress)).toBe(1);
  });

  it('returns null when all 90 levels are completed', () => {
    const allLevels: CampaignLevelProgress[] = [];
    for (let i = 1; i <= 90; i++) {
      allLevels.push({ levelNumber: i, stars: 3, completed: true });
    }
    const progress = makeProgress(allLevels);
    expect(getNextUncompletedLevel(progress)).toBeNull();
  });

  it('skips completed levels and finds the first gap', () => {
    const progress = makeProgress([
      { levelNumber: 1, stars: 3, completed: true },
      { levelNumber: 2, stars: 2, completed: true },
      { levelNumber: 3, stars: 1, completed: true },
      // Level 4 is missing
      { levelNumber: 5, stars: 3, completed: true },
    ]);
    expect(getNextUncompletedLevel(progress)).toBe(4);
  });
});
