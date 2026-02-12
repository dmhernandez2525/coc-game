/** Grid and isometric coordinate utilities for the 44x44 village grid. */

export const GRID_SIZE = 44;
export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 16;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface GridPoint {
  gridX: number;
  gridY: number;
}

/** Convert grid coordinates to isometric screen coordinates. */
export function gridToScreen(gridX: number, gridY: number): ScreenPoint {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

/** Convert isometric screen coordinates back to grid coordinates. */
export function screenToGrid(screenX: number, screenY: number): GridPoint {
  const gridX = Math.floor(
    screenX / TILE_WIDTH + screenY / TILE_HEIGHT,
  );
  const gridY = Math.floor(
    screenY / TILE_HEIGHT - screenX / TILE_WIDTH,
  );
  return { gridX, gridY };
}

/** Check whether a grid coordinate is within bounds (0..GRID_SIZE-1). */
export function isInBounds(gridX: number, gridY: number): boolean {
  return gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE;
}

/**
 * Check if a rectangular building footprint is clear of other buildings.
 * occupied is a Set of "gridX,gridY" keys for tiles already taken.
 */
export function canPlaceBuilding(
  gridX: number,
  gridY: number,
  width: number,
  height: number,
  occupied: Set<string>,
): boolean {
  for (let dx = 0; dx < width; dx++) {
    for (let dy = 0; dy < height; dy++) {
      const tx = gridX + dx;
      const ty = gridY + dy;
      if (!isInBounds(tx, ty)) return false;
      if (occupied.has(`${tx},${ty}`)) return false;
    }
  }
  return true;
}

/**
 * Build a set of occupied tile keys from a list of placed buildings.
 * Each building occupies width x height tiles starting at its (gridX, gridY).
 */
export function buildOccupiedSet(
  buildings: ReadonlyArray<{ gridX: number; gridY: number; width: number; height: number }>,
): Set<string> {
  const set = new Set<string>();
  for (const b of buildings) {
    for (let dx = 0; dx < b.width; dx++) {
      for (let dy = 0; dy < b.height; dy++) {
        set.add(`${b.gridX + dx},${b.gridY + dy}`);
      }
    }
  }
  return set;
}

/** Parse a tileSize string like "3x3" into width and height. */
export function parseTileSizeStr(raw: string): { width: number; height: number } {
  const parts = raw.split('x');
  return { width: Number(parts[0]), height: Number(parts[1]) };
}
