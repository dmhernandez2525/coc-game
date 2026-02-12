import type { PlacedBuilding, PlacedWall } from '../../types/village.ts';
import {
  getBuildingTileSize,
  canPlaceBuilding,
  getBuildingAt,
  getWallAt,
} from '../collision.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuilding(
  id: string,
  type: PlacedBuilding['buildingType'],
  gridX: number,
  gridY: number,
): PlacedBuilding {
  return {
    instanceId: `test_${id}_${gridX}_${gridY}`,
    buildingId: id,
    buildingType: type,
    level: 1,
    gridX,
    gridY,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

function makeWall(gridX: number, gridY: number): PlacedWall {
  return {
    instanceId: `wall_${gridX}_${gridY}`,
    gridX,
    gridY,
    level: 1,
  };
}

// ---------------------------------------------------------------------------
// getBuildingTileSize
// ---------------------------------------------------------------------------

describe('getBuildingTileSize', () => {
  it('returns the correct size for a known defense building (Cannon is 3x3)', () => {
    const size = getBuildingTileSize('Cannon');
    expect(size).toEqual({ width: 3, height: 3 });
  });

  it('returns the correct size for a non-defense building in the hardcoded table (Town Hall is 4x4)', () => {
    const size = getBuildingTileSize('Town Hall');
    expect(size).toEqual({ width: 4, height: 4 });
  });

  it('returns 4x4 for Laboratory from the hardcoded table', () => {
    const size = getBuildingTileSize('Laboratory');
    expect(size).toEqual({ width: 4, height: 4 });
  });

  it('returns 2x2 for Builder\'s Hut from the hardcoded table', () => {
    const size = getBuildingTileSize("Builder's Hut");
    expect(size).toEqual({ width: 2, height: 2 });
  });

  it('returns 5x5 for Army Camp from the hardcoded table', () => {
    const size = getBuildingTileSize('Army Camp');
    expect(size).toEqual({ width: 5, height: 5 });
  });

  it('returns the 3x3 default for a completely unknown building', () => {
    const size = getBuildingTileSize('NonExistentBuilding_XYZ');
    expect(size).toEqual({ width: 3, height: 3 });
  });
});

// ---------------------------------------------------------------------------
// canPlaceBuilding
// ---------------------------------------------------------------------------

describe('canPlaceBuilding', () => {
  it('allows placement on an empty grid', () => {
    const result = canPlaceBuilding(10, 10, 3, 3, [], []);
    expect(result).toBe(true);
  });

  it('allows placement next to an existing building without overlapping', () => {
    // Place a 3x3 building at (5,5), then try placing another 3x3 at (8,5).
    // The first occupies columns 5-7, the second starts at column 8, so no overlap.
    const existing = [makeBuilding('Gold Mine', 'resource_collector', 5, 5)];
    const result = canPlaceBuilding(8, 5, 3, 3, existing, []);
    expect(result).toBe(true);
  });

  it('rejects placement that fully overlaps an existing building', () => {
    const existing = [makeBuilding('Gold Mine', 'resource_collector', 5, 5)];
    // Attempt to place exactly on top of the existing building
    const result = canPlaceBuilding(5, 5, 3, 3, existing, []);
    expect(result).toBe(false);
  });

  it('rejects placement that partially overlaps an existing building', () => {
    // Existing 3x3 at (5,5) occupies (5,5) to (7,7). Placing at (7,7) overlaps at tile (7,7).
    const existing = [makeBuilding('Gold Mine', 'resource_collector', 5, 5)];
    const result = canPlaceBuilding(7, 7, 3, 3, existing, []);
    expect(result).toBe(false);
  });

  it('rejects placement that overlaps a wall segment', () => {
    const walls = [makeWall(10, 10)];
    // 3x3 building at (9,9) occupies (9,9) through (11,11), which includes (10,10)
    const result = canPlaceBuilding(9, 9, 3, 3, [], walls);
    expect(result).toBe(false);
  });

  it('rejects placement that goes out of the grid bounds (negative coordinates)', () => {
    const result = canPlaceBuilding(-1, 0, 3, 3, [], []);
    expect(result).toBe(false);
  });

  it('rejects placement that extends beyond the grid upper bound', () => {
    // Grid is 44x44 (indices 0-43). A 3x3 at (42,42) would need tiles 42,43,44 which is out of bounds.
    const result = canPlaceBuilding(42, 42, 3, 3, [], []);
    expect(result).toBe(false);
  });

  it('allows placement at the very edge of the grid if it fits', () => {
    // A 3x3 building at (41,41) occupies tiles 41,42,43 in both axes, which fits in a 44-wide grid.
    const result = canPlaceBuilding(41, 41, 3, 3, [], []);
    expect(result).toBe(true);
  });

  it('correctly resolves building sizes when checking for overlaps with larger buildings', () => {
    // Town Hall is 4x4. Place it at (10,10), occupying (10,10)-(13,13).
    // Try to place a 3x3 at (13,10). That starts right after the TH ends, so it should be allowed.
    const existing = [makeBuilding('Town Hall', 'other', 10, 10)];
    const resultClear = canPlaceBuilding(14, 10, 3, 3, existing, []);
    expect(resultClear).toBe(true);

    // A 3x3 at (12,12) would overlap with the TH at (12,12) and (13,13).
    const resultOverlap = canPlaceBuilding(12, 12, 3, 3, existing, []);
    expect(resultOverlap).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getBuildingAt
// ---------------------------------------------------------------------------

describe('getBuildingAt', () => {
  const townHall = makeBuilding('Town Hall', 'other', 10, 10);
  const goldMine = makeBuilding('Gold Mine', 'resource_collector', 20, 20);
  const buildings = [townHall, goldMine];

  it('finds a building when clicking inside its footprint', () => {
    // Town Hall is 4x4 at (10,10), so (11,11) is inside.
    const result = getBuildingAt(11, 11, buildings);
    expect(result).toBe(townHall);
  });

  it('finds a building at the exact origin tile', () => {
    const result = getBuildingAt(10, 10, buildings);
    expect(result).toBe(townHall);
  });

  it('finds a building at the far edge of its footprint', () => {
    // Town Hall is 4x4 at (10,10), so the last included tile is (13,13).
    const result = getBuildingAt(13, 13, buildings);
    expect(result).toBe(townHall);
  });

  it('returns undefined for a tile just outside the footprint', () => {
    // (14,14) is one tile beyond the 4x4 Town Hall at (10,10).
    const result = getBuildingAt(14, 14, buildings);
    expect(result).toBeUndefined();
  });

  it('returns undefined for a completely empty tile', () => {
    const result = getBuildingAt(0, 0, buildings);
    expect(result).toBeUndefined();
  });

  it('handles multiple buildings and returns the correct one', () => {
    // Gold Mine is 3x3 at (20,20), so (21,21) is inside the Gold Mine.
    const result = getBuildingAt(21, 21, buildings);
    expect(result).toBe(goldMine);
  });

  it('returns the first match when buildings overlap (edge case)', () => {
    // Two buildings placed at the same position (shouldn't happen in practice, but tests
    // that the function returns the first one it finds).
    const b1 = makeBuilding('Gold Mine', 'resource_collector', 5, 5);
    const b2 = makeBuilding('Elixir Collector', 'resource_collector', 5, 5);
    const result = getBuildingAt(6, 6, [b1, b2]);
    expect(result).toBe(b1);
  });

  it('returns undefined for an empty buildings array', () => {
    const result = getBuildingAt(10, 10, []);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getWallAt
// ---------------------------------------------------------------------------

describe('getWallAt', () => {
  const walls = [makeWall(5, 5), makeWall(5, 6), makeWall(5, 7)];

  it('finds a wall at the exact matching position', () => {
    const result = getWallAt(5, 5, walls);
    expect(result).toBe(walls[0]);
  });

  it('finds the correct wall when multiple walls exist', () => {
    const result = getWallAt(5, 7, walls);
    expect(result).toBe(walls[2]);
  });

  it('returns undefined when no wall occupies the given position', () => {
    const result = getWallAt(10, 10, walls);
    expect(result).toBeUndefined();
  });

  it('returns undefined for an empty walls array', () => {
    const result = getWallAt(5, 5, []);
    expect(result).toBeUndefined();
  });

  it('does not match walls at an adjacent tile', () => {
    // (6,5) is right next to the wall at (5,5) but should not match.
    const result = getWallAt(6, 5, walls);
    expect(result).toBeUndefined();
  });
});
