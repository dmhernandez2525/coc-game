import { wallData } from '../data/loaders/economy-loader.ts';
import type { PlacedWall } from '../types/village.ts';
import type { WallLevelStats } from '../types/buildings.ts';

/** Returns the maximum number of wall segments allowed at a given TH level. */
export function getMaxWallSegments(thLevel: number): number {
  if (thLevel <= 1) return 0;
  return wallData.maxSegmentsByTH[String(thLevel)] ?? 0;
}

/** Returns the maximum wall level allowed at a given TH level. */
export function getMaxWallLevel(thLevel: number): number {
  if (thLevel <= 1) return 0;
  return wallData.maxLevelByTH[String(thLevel)] ?? 0;
}

/** Looks up stats for a specific wall level from the data. */
export function getWallStats(level: number): WallLevelStats | undefined {
  return wallData.levels.find((l) => l.level === level);
}

/**
 * Places a new level 1 wall at the given grid position.
 * Returns null if the village is already at the max segment count for its TH.
 * Returns a new array containing all existing walls plus the new one.
 */
export function placeWall(
  walls: PlacedWall[],
  gridX: number,
  gridY: number,
  thLevel: number,
): PlacedWall[] | null {
  const max = getMaxWallSegments(thLevel);
  if (walls.length >= max) return null;

  const newWall: PlacedWall = {
    instanceId: `wall_${Date.now()}_${walls.length}`,
    level: 1,
    gridX,
    gridY,
  };

  return [...walls, newWall];
}

/**
 * Upgrades a wall segment by one level.
 * Returns null if the wall is not found, is already at the max level for the
 * current TH, or if stats for the next level do not exist.
 * Otherwise returns the new walls array and the upgrade cost.
 */
export function upgradeWall(
  walls: PlacedWall[],
  instanceId: string,
  thLevel: number,
): { walls: PlacedWall[]; cost: { amount: number; resource: string } } | null {
  const wall = walls.find((w) => w.instanceId === instanceId);
  if (!wall) return null;

  const maxLevel = getMaxWallLevel(thLevel);
  if (wall.level >= maxLevel) return null;

  const nextLevel = wall.level + 1;
  const nextStats = getWallStats(nextLevel);
  if (!nextStats) return null;

  const updatedWalls = walls.map((w) =>
    w.instanceId === instanceId ? { ...w, level: nextLevel } : w,
  );

  return {
    walls: updatedWalls,
    cost: {
      amount: nextStats.upgradeCost,
      resource: nextStats.upgradeResource,
    },
  };
}

/** Removes a wall segment by instanceId. Returns a new filtered array. */
export function removeWall(walls: PlacedWall[], instanceId: string): PlacedWall[] {
  const filtered = walls.filter((w) => w.instanceId !== instanceId);
  // Return the same reference if nothing was removed
  if (filtered.length === walls.length) return walls;
  return filtered;
}

/**
 * Returns the cost to upgrade a wall FROM the given level to the next level.
 * Returns null if no next level exists in the data.
 */
export function getWallUpgradeCost(
  level: number,
): { amount: number; resource: string } | null {
  const nextStats = getWallStats(level + 1);
  if (!nextStats) return null;

  return {
    amount: nextStats.upgradeCost,
    resource: nextStats.upgradeResource,
  };
}
