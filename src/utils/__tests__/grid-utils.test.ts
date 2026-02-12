import {
  GRID_SIZE,
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToScreen,
  screenToGrid,
  isInBounds,
  canPlaceBuilding,
  buildOccupiedSet,
  parseTileSizeStr,
} from '../grid-utils';

// ---------------------------------------------------------------------------
// 1. Constants
// ---------------------------------------------------------------------------
describe('constants', () => {
  it('GRID_SIZE is 44', () => {
    expect(GRID_SIZE).toBe(44);
  });

  it('TILE_WIDTH is 32', () => {
    expect(TILE_WIDTH).toBe(32);
  });

  it('TILE_HEIGHT is 16', () => {
    expect(TILE_HEIGHT).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// 2. gridToScreen
// ---------------------------------------------------------------------------
describe('gridToScreen', () => {
  it('maps the origin (0,0) to screen (0,0)', () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('maps (1,0) to (16, 8)', () => {
    // x = (1 - 0) * 16 = 16, y = (1 + 0) * 8 = 8
    expect(gridToScreen(1, 0)).toEqual({ x: 16, y: 8 });
  });

  it('maps (0,1) to (-16, 8)', () => {
    // x = (0 - 1) * 16 = -16, y = (0 + 1) * 8 = 8
    expect(gridToScreen(0, 1)).toEqual({ x: -16, y: 8 });
  });

  it('maps (10,10) to (0, 160)', () => {
    // x = (10 - 10) * 16 = 0, y = (10 + 10) * 8 = 160
    expect(gridToScreen(10, 10)).toEqual({ x: 0, y: 160 });
  });

  it('handles negative grid values', () => {
    // x = (-2 - 3) * 16 = -80, y = (-2 + 3) * 8 = 8
    expect(gridToScreen(-2, 3)).toEqual({ x: -80, y: 8 });
  });
});

// ---------------------------------------------------------------------------
// 3. screenToGrid
// ---------------------------------------------------------------------------
describe('screenToGrid', () => {
  it('maps screen origin (0,0) back to grid (0,0)', () => {
    expect(screenToGrid(0, 0)).toEqual({ gridX: 0, gridY: 0 });
  });

  it('round-trips (1,0) through gridToScreen and back', () => {
    const screen = gridToScreen(1, 0);
    expect(screenToGrid(screen.x, screen.y)).toEqual({ gridX: 1, gridY: 0 });
  });

  it('round-trips (0,1) through gridToScreen and back', () => {
    const screen = gridToScreen(0, 1);
    expect(screenToGrid(screen.x, screen.y)).toEqual({ gridX: 0, gridY: 1 });
  });

  it('round-trips (5,7) through gridToScreen and back', () => {
    const screen = gridToScreen(5, 7);
    expect(screenToGrid(screen.x, screen.y)).toEqual({ gridX: 5, gridY: 7 });
  });

  it('round-trips (43,43) (max corner) through gridToScreen and back', () => {
    const screen = gridToScreen(43, 43);
    expect(screenToGrid(screen.x, screen.y)).toEqual({ gridX: 43, gridY: 43 });
  });
});

// ---------------------------------------------------------------------------
// 4. isInBounds
// ---------------------------------------------------------------------------
describe('isInBounds', () => {
  it('returns true for (0,0)', () => {
    expect(isInBounds(0, 0)).toBe(true);
  });

  it('returns true for (43,43)', () => {
    expect(isInBounds(43, 43)).toBe(true);
  });

  it('returns false for (-1,0)', () => {
    expect(isInBounds(-1, 0)).toBe(false);
  });

  it('returns false for (44,0)', () => {
    expect(isInBounds(44, 0)).toBe(false);
  });

  it('returns false for (0,-1)', () => {
    expect(isInBounds(0, -1)).toBe(false);
  });

  it('returns false for (0,44)', () => {
    expect(isInBounds(0, 44)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. canPlaceBuilding
// ---------------------------------------------------------------------------
describe('canPlaceBuilding', () => {
  it('allows placement on a completely empty grid', () => {
    const occupied = new Set<string>();
    expect(canPlaceBuilding(0, 0, 3, 3, occupied)).toBe(true);
  });

  it('rejects placement that goes out of bounds (negative origin)', () => {
    const occupied = new Set<string>();
    expect(canPlaceBuilding(-1, 0, 1, 1, occupied)).toBe(false);
  });

  it('rejects placement when building extends past the grid edge', () => {
    // A 3x3 building at (42,42) would occupy tiles up to (44,44), which is out of bounds
    const occupied = new Set<string>();
    expect(canPlaceBuilding(42, 42, 3, 3, occupied)).toBe(false);
  });

  it('rejects placement overlapping an occupied tile', () => {
    const occupied = new Set<string>(['1,1']);
    // A 3x3 building at (0,0) covers tiles (0,0) through (2,2), including (1,1)
    expect(canPlaceBuilding(0, 0, 3, 3, occupied)).toBe(false);
  });

  it('allows placement adjacent to occupied tiles without overlap', () => {
    const occupied = new Set<string>(['0,0', '1,0', '2,0']);
    // Place a 2x2 building at (3,0), which does not overlap the occupied row
    expect(canPlaceBuilding(3, 0, 2, 2, occupied)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. buildOccupiedSet
// ---------------------------------------------------------------------------
describe('buildOccupiedSet', () => {
  it('returns an empty set for an empty building list', () => {
    const result = buildOccupiedSet([]);
    expect(result.size).toBe(0);
  });

  it('returns 9 entries for a single 3x3 building', () => {
    const result = buildOccupiedSet([{ gridX: 5, gridY: 5, width: 3, height: 3 }]);
    expect(result.size).toBe(9);
    // Verify all expected keys are present
    for (let dx = 0; dx < 3; dx++) {
      for (let dy = 0; dy < 3; dy++) {
        expect(result.has(`${5 + dx},${5 + dy}`)).toBe(true);
      }
    }
  });

  it('combines multiple non-overlapping buildings correctly', () => {
    const result = buildOccupiedSet([
      { gridX: 0, gridY: 0, width: 2, height: 2 },
      { gridX: 10, gridY: 10, width: 3, height: 1 },
    ]);
    // 2*2 + 3*1 = 7 tiles total
    expect(result.size).toBe(7);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('1,1')).toBe(true);
    expect(result.has('10,10')).toBe(true);
    expect(result.has('12,10')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. parseTileSizeStr
// ---------------------------------------------------------------------------
describe('parseTileSizeStr', () => {
  it('parses "3x3" into { width: 3, height: 3 }', () => {
    expect(parseTileSizeStr('3x3')).toEqual({ width: 3, height: 3 });
  });

  it('parses "4x4" into { width: 4, height: 4 }', () => {
    expect(parseTileSizeStr('4x4')).toEqual({ width: 4, height: 4 });
  });

  it('parses "5x5" into { width: 5, height: 5 }', () => {
    expect(parseTileSizeStr('5x5')).toEqual({ width: 5, height: 5 });
  });
});
