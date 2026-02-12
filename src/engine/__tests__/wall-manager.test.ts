import type { PlacedWall } from '../../types/village.ts';
import {
  getMaxWallSegments,
  getMaxWallLevel,
  getWallStats,
  placeWall,
  upgradeWall,
  removeWall,
  getWallUpgradeCost,
} from '../wall-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWall(overrides: Partial<PlacedWall> = {}): PlacedWall {
  return {
    instanceId: `wall_test_${Math.random().toString(36).slice(2, 8)}`,
    level: 1,
    gridX: 0,
    gridY: 0,
    ...overrides,
  };
}

function makeWalls(count: number, baseLevel = 1): PlacedWall[] {
  return Array.from({ length: count }, (_, i) =>
    makeWall({ instanceId: `wall_${i}`, gridX: i, gridY: 0, level: baseLevel }),
  );
}

// ===========================================================================
// getMaxWallSegments
// ===========================================================================
describe('getMaxWallSegments', () => {
  // ---
  it('returns 0 for TH1 (walls not unlocked)', () => {
    expect(getMaxWallSegments(1)).toBe(0);
  });

  // ---
  it('returns 0 for TH level 0 or below', () => {
    expect(getMaxWallSegments(0)).toBe(0);
    expect(getMaxWallSegments(-5)).toBe(0);
  });

  // ---
  it('returns 25 for TH2', () => {
    expect(getMaxWallSegments(2)).toBe(25);
  });

  // ---
  it('returns 50 for TH3', () => {
    expect(getMaxWallSegments(3)).toBe(50);
  });

  // ---
  it('returns 325 for TH12 and higher', () => {
    expect(getMaxWallSegments(12)).toBe(325);
    expect(getMaxWallSegments(15)).toBe(325);
    expect(getMaxWallSegments(18)).toBe(325);
  });

  // ---
  it('returns 0 for an unknown TH level far beyond the data', () => {
    expect(getMaxWallSegments(99)).toBe(0);
  });
});

// ===========================================================================
// getMaxWallLevel
// ===========================================================================
describe('getMaxWallLevel', () => {
  // ---
  it('returns 0 for TH1', () => {
    expect(getMaxWallLevel(1)).toBe(0);
  });

  // ---
  it('returns 0 for negative TH levels', () => {
    expect(getMaxWallLevel(-1)).toBe(0);
  });

  // ---
  it('returns 2 for TH2', () => {
    expect(getMaxWallLevel(2)).toBe(2);
  });

  // ---
  it('returns 10 for TH9', () => {
    expect(getMaxWallLevel(9)).toBe(10);
  });

  // ---
  it('returns 19 for TH18 (highest defined)', () => {
    expect(getMaxWallLevel(18)).toBe(19);
  });

  // ---
  it('returns 0 for an unknown TH level with no data entry', () => {
    expect(getMaxWallLevel(100)).toBe(0);
  });
});

// ===========================================================================
// getWallStats
// ===========================================================================
describe('getWallStats', () => {
  // ---
  it('returns stats for wall level 1', () => {
    const stats = getWallStats(1);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.hitpoints).toBe(100);
    expect(stats!.upgradeCost).toBe(0);
  });

  // ---
  it('returns stats for wall level 2 with expected cost', () => {
    const stats = getWallStats(2);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(2);
    expect(stats!.hitpoints).toBe(200);
    expect(stats!.upgradeCost).toBe(1000);
    expect(stats!.upgradeResource).toBe('Gold');
  });

  // ---
  it('returns stats for wall level 19 (highest level)', () => {
    const stats = getWallStats(19);
    expect(stats).toBeDefined();
    expect(stats!.hitpoints).toBe(14000);
    expect(stats!.upgradeCost).toBe(10_000_000);
  });

  // ---
  it('returns undefined for level 0 (does not exist)', () => {
    expect(getWallStats(0)).toBeUndefined();
  });

  // ---
  it('returns undefined for level 20 (beyond max)', () => {
    expect(getWallStats(20)).toBeUndefined();
  });

  // ---
  it('returns undefined for negative levels', () => {
    expect(getWallStats(-1)).toBeUndefined();
  });
});

// ===========================================================================
// placeWall
// ===========================================================================
describe('placeWall', () => {
  // ---
  it('places a wall and returns a new array with the wall appended', () => {
    const walls: PlacedWall[] = [];
    const result = placeWall(walls, 5, 10, 2);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]!.gridX).toBe(5);
    expect(result![0]!.gridY).toBe(10);
    expect(result![0]!.level).toBe(1);
  });

  // ---
  it('generates a unique instanceId for the new wall', () => {
    const walls: PlacedWall[] = [];
    const result = placeWall(walls, 0, 0, 2);

    expect(result).not.toBeNull();
    expect(result![0]!.instanceId).toMatch(/^wall_/);
  });

  // ---
  it('preserves existing walls in the returned array', () => {
    const existing = makeWalls(3);
    const result = placeWall(existing, 10, 10, 2);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
    // First three should be the originals
    expect(result![0]!.instanceId).toBe(existing[0]!.instanceId);
    expect(result![1]!.instanceId).toBe(existing[1]!.instanceId);
    expect(result![2]!.instanceId).toBe(existing[2]!.instanceId);
  });

  // ---
  it('returns null at TH1 since max segments is 0', () => {
    const result = placeWall([], 0, 0, 1);
    expect(result).toBeNull();
  });

  // ---
  it('returns null for TH levels below 1', () => {
    expect(placeWall([], 0, 0, 0)).toBeNull();
    expect(placeWall([], 0, 0, -1)).toBeNull();
  });

  // ---
  it('returns null when max segments is already reached', () => {
    // TH2 allows 25 segments
    const walls = makeWalls(25);
    const result = placeWall(walls, 30, 30, 2);
    expect(result).toBeNull();
  });

  // ---
  it('allows placement when one below the max', () => {
    // TH2 allows 25 segments; 24 placed so far
    const walls = makeWalls(24);
    const result = placeWall(walls, 30, 30, 2);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(25);
  });

  // ---
  it('does not mutate the original walls array', () => {
    const walls = makeWalls(2);
    const originalLength = walls.length;
    placeWall(walls, 10, 10, 2);
    expect(walls).toHaveLength(originalLength);
  });

  // ---
  it('returns null for an unknown TH level with 0 max segments', () => {
    const result = placeWall([], 0, 0, 99);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// upgradeWall
// ===========================================================================
describe('upgradeWall', () => {
  // ---
  it('upgrades a level 1 wall to level 2 at TH2', () => {
    const walls = [makeWall({ instanceId: 'w1', level: 1 })];
    const result = upgradeWall(walls, 'w1', 2);

    expect(result).not.toBeNull();
    const upgraded = result!.walls.find((w) => w.instanceId === 'w1');
    expect(upgraded!.level).toBe(2);
  });

  // ---
  it('returns the correct upgrade cost for level 1 to 2', () => {
    const walls = [makeWall({ instanceId: 'w1', level: 1 })];
    const result = upgradeWall(walls, 'w1', 2);

    expect(result).not.toBeNull();
    expect(result!.cost.amount).toBe(1000);
    expect(result!.cost.resource).toBe('Gold');
  });

  // ---
  it('returns null when the wall instanceId is not found', () => {
    const walls = [makeWall({ instanceId: 'w1' })];
    const result = upgradeWall(walls, 'nonexistent', 5);
    expect(result).toBeNull();
  });

  // ---
  it('returns null when the wall is already at max level for the TH', () => {
    // TH2 max wall level is 2
    const walls = [makeWall({ instanceId: 'w1', level: 2 })];
    const result = upgradeWall(walls, 'w1', 2);
    expect(result).toBeNull();
  });

  // ---
  it('returns null when trying to upgrade beyond the highest defined level', () => {
    // Level 19 is the highest; there are no stats for level 20
    // TH18 allows up to level 19
    const walls = [makeWall({ instanceId: 'w1', level: 19 })];
    const result = upgradeWall(walls, 'w1', 18);
    expect(result).toBeNull();
  });

  // ---
  it('does not mutate the original walls array', () => {
    const walls = [makeWall({ instanceId: 'w1', level: 1 })];
    const wallsCopy = [...walls];
    upgradeWall(walls, 'w1', 5);

    expect(walls).toHaveLength(wallsCopy.length);
    expect(walls[0]!.level).toBe(1);
  });

  // ---
  it('only upgrades the targeted wall, leaving others untouched', () => {
    const walls = [
      makeWall({ instanceId: 'w1', level: 1, gridX: 0 }),
      makeWall({ instanceId: 'w2', level: 3, gridX: 1 }),
      makeWall({ instanceId: 'w3', level: 5, gridX: 2 }),
    ];
    const result = upgradeWall(walls, 'w2', 9);

    expect(result).not.toBeNull();
    expect(result!.walls.find((w) => w.instanceId === 'w1')!.level).toBe(1);
    expect(result!.walls.find((w) => w.instanceId === 'w2')!.level).toBe(4);
    expect(result!.walls.find((w) => w.instanceId === 'w3')!.level).toBe(5);
  });

  // ---
  it('returns the correct cost for a mid-level upgrade (level 4 to 5)', () => {
    const walls = [makeWall({ instanceId: 'w1', level: 4 })];
    const result = upgradeWall(walls, 'w1', 7);

    expect(result).not.toBeNull();
    expect(result!.cost.amount).toBe(20_000);
    expect(result!.cost.resource).toBe('Gold or Elixir');
  });

  // ---
  it('returns null when upgrading with an empty walls array', () => {
    const result = upgradeWall([], 'w1', 5);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// removeWall
// ===========================================================================
describe('removeWall', () => {
  // ---
  it('removes a wall by instanceId', () => {
    const walls = makeWalls(3);
    const toRemove = walls[1]!.instanceId;
    const result = removeWall(walls, toRemove);

    expect(result).toHaveLength(2);
    expect(result.find((w) => w.instanceId === toRemove)).toBeUndefined();
  });

  // ---
  it('returns the same array reference when instanceId does not exist', () => {
    const walls = makeWalls(3);
    const result = removeWall(walls, 'nonexistent_id');

    // Same reference means no copy was created
    expect(result).toBe(walls);
  });

  // ---
  it('returns a new array reference when a wall is removed', () => {
    const walls = makeWalls(3);
    const result = removeWall(walls, walls[0]!.instanceId);

    expect(result).not.toBe(walls);
    expect(result).toHaveLength(2);
  });

  // ---
  it('preserves the remaining walls in order', () => {
    const walls = makeWalls(5);
    const result = removeWall(walls, walls[2]!.instanceId);

    expect(result).toHaveLength(4);
    expect(result[0]!.instanceId).toBe(walls[0]!.instanceId);
    expect(result[1]!.instanceId).toBe(walls[1]!.instanceId);
    expect(result[2]!.instanceId).toBe(walls[3]!.instanceId);
    expect(result[3]!.instanceId).toBe(walls[4]!.instanceId);
  });

  // ---
  it('does not mutate the original array', () => {
    const walls = makeWalls(3);
    const originalLength = walls.length;
    removeWall(walls, walls[0]!.instanceId);
    expect(walls).toHaveLength(originalLength);
  });

  // ---
  it('handles removing from a single-element array', () => {
    const walls = [makeWall({ instanceId: 'only_wall' })];
    const result = removeWall(walls, 'only_wall');
    expect(result).toHaveLength(0);
  });

  // ---
  it('handles an empty walls array gracefully', () => {
    const result = removeWall([], 'any_id');
    expect(result).toHaveLength(0);
  });
});

// ===========================================================================
// getWallUpgradeCost
// ===========================================================================
describe('getWallUpgradeCost', () => {
  // ---
  it('returns the cost to upgrade from level 1 to level 2', () => {
    const cost = getWallUpgradeCost(1);
    expect(cost).not.toBeNull();
    expect(cost!.amount).toBe(1000);
    expect(cost!.resource).toBe('Gold');
  });

  // ---
  it('returns the cost to upgrade from level 8 to level 9', () => {
    const cost = getWallUpgradeCost(8);
    expect(cost).not.toBeNull();
    expect(cost!.amount).toBe(100_000);
    expect(cost!.resource).toBe('Gold or Elixir');
  });

  // ---
  it('returns null when the next level does not exist (level 19 is max)', () => {
    const cost = getWallUpgradeCost(19);
    expect(cost).toBeNull();
  });

  // ---
  it('returns null for levels far beyond the data range', () => {
    expect(getWallUpgradeCost(100)).toBeNull();
  });

  // ---
  it('returns null for level 0 since level 1 upgrade cost is 0 (still returns stats)', () => {
    // Level 0 looks up level 1, which does exist with cost 0
    const cost = getWallUpgradeCost(0);
    expect(cost).not.toBeNull();
    expect(cost!.amount).toBe(0);
  });

  // ---
  it('returns null for negative levels if no matching next-level exists', () => {
    // Level -1 looks up level 0, which does not exist
    const cost = getWallUpgradeCost(-1);
    expect(cost).toBeNull();
  });
});
