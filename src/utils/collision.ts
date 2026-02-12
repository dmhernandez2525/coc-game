// Building placement collision detection for the village grid.
// Wraps grid-utils primitives with building-aware logic that
// resolves tile sizes from the game data loaders.

import type { TileSize } from '../types/common.ts';
import type { PlacedBuilding, PlacedWall } from '../types/village.ts';
import { parseTileSize } from '../types/common.ts';
import { getDefense } from '../data/loaders/defense-loader.ts';
import {
  canPlaceBuilding as canPlaceOnGrid,
  buildOccupiedSet,
} from './grid-utils.ts';

// Default tile sizes for buildings whose JSON data lacks a tileSize field.
// These match the official Clash of Clans tile footprints.
const BUILDING_TILE_SIZES: Record<string, TileSize> = {
  'Town Hall': { width: 4, height: 4 },
  'Gold Mine': { width: 3, height: 3 },
  'Elixir Collector': { width: 3, height: 3 },
  'Dark Elixir Drill': { width: 3, height: 3 },
  'Gold Storage': { width: 3, height: 3 },
  'Elixir Storage': { width: 3, height: 3 },
  'Dark Elixir Storage': { width: 3, height: 3 },
  'Army Camp': { width: 5, height: 5 },
  'Barracks': { width: 3, height: 3 },
  'Dark Barracks': { width: 3, height: 3 },
  'Laboratory': { width: 4, height: 4 },
  'Spell Factory': { width: 3, height: 3 },
  'Dark Spell Factory': { width: 3, height: 3 },
  'Workshop': { width: 4, height: 4 },
  'Pet House': { width: 4, height: 4 },
  'Hero Hall': { width: 3, height: 3 },
  'Clan Castle': { width: 3, height: 3 },
  "Builder's Hut": { width: 2, height: 2 },
};

/**
 * Look up the tile size for a building by its buildingId (name).
 * Checks defense data first (which stores tileSize in JSON),
 * then falls back to the hardcoded lookup table, and finally
 * returns a 3x3 default if nothing is found.
 */
export function getBuildingTileSize(buildingId: string): TileSize {
  const defense = getDefense(buildingId);
  if (defense) {
    return parseTileSize(defense.tileSize);
  }

  const known = BUILDING_TILE_SIZES[buildingId];
  if (known) {
    return known;
  }

  // Conservative fallback: 3x3 is the most common building size
  return { width: 3, height: 3 };
}

/**
 * Build a combined occupied tile set from existing buildings and walls.
 * Each building's footprint is resolved via getBuildingTileSize, and
 * each wall occupies a single 1x1 tile.
 */
function buildFullOccupiedSet(
  existingBuildings: PlacedBuilding[],
  existingWalls: PlacedWall[],
): Set<string> {
  const rects = existingBuildings.map((b) => {
    const size = getBuildingTileSize(b.buildingId);
    return {
      gridX: b.gridX,
      gridY: b.gridY,
      width: size.width,
      height: size.height,
    };
  });

  const wallRects = existingWalls.map((w) => ({
    gridX: w.gridX,
    gridY: w.gridY,
    width: 1,
    height: 1,
  }));

  return buildOccupiedSet([...rects, ...wallRects]);
}

/**
 * Check whether a building of the given tile dimensions can be placed
 * at (gridX, gridY) without going out of bounds or overlapping any
 * existing building or wall segment.
 */
export function canPlaceBuilding(
  gridX: number,
  gridY: number,
  width: number,
  height: number,
  existingBuildings: PlacedBuilding[],
  existingWalls: PlacedWall[],
): boolean {
  const occupied = buildFullOccupiedSet(existingBuildings, existingWalls);
  return canPlaceOnGrid(gridX, gridY, width, height, occupied);
}

/**
 * Find the building occupying a specific grid tile, if any.
 * Returns the first building whose footprint covers the given position.
 */
export function getBuildingAt(
  gridX: number,
  gridY: number,
  buildings: PlacedBuilding[],
): PlacedBuilding | undefined {
  for (const building of buildings) {
    const size = getBuildingTileSize(building.buildingId);
    const withinX =
      gridX >= building.gridX && gridX < building.gridX + size.width;
    const withinY =
      gridY >= building.gridY && gridY < building.gridY + size.height;
    if (withinX && withinY) {
      return building;
    }
  }
  return undefined;
}

/**
 * Find the wall segment at a specific grid tile, if any.
 */
export function getWallAt(
  gridX: number,
  gridY: number,
  walls: PlacedWall[],
): PlacedWall | undefined {
  return walls.find((w) => w.gridX === gridX && w.gridY === gridY);
}
