import { traps as trapsData } from '../data/loaders/economy-loader.ts';
import type { PlacedTrap } from '../types/village.ts';
import type { TrapData, TrapLevelStats } from '../types/buildings.ts';

/** Find a trap definition by its name. */
export function getTrapData(trapId: string): TrapData | undefined {
  return trapsData.find((t) => t.name === trapId);
}

/** Get stats for a specific trap at a given level. */
export function getTrapStats(trapId: string, level: number): TrapLevelStats | undefined {
  const trap = getTrapData(trapId);
  if (!trap) return undefined;
  return trap.levels.find((l) => l.level === level);
}

/** Returns the max allowed count for a trap type at a TH level. Returns 0 if not found. */
export function getMaxTrapCount(trapId: string, thLevel: number): number {
  const trap = getTrapData(trapId);
  if (!trap) return 0;
  return trap.maxCountByTH[String(thLevel)] ?? 0;
}

/** Counts how many placed traps match the given trap type. */
export function getCurrentTrapCount(traps: PlacedTrap[], trapId: string): number {
  return traps.filter((t) => t.trapId === trapId).length;
}

/**
 * Places a new level 1 trap at the given grid position.
 * Returns null if the trap type is not found, the TH level is too low
 * to unlock this trap, or the max count for this trap type has been reached.
 * New traps start armed.
 */
export function placeTrap(
  existingTraps: PlacedTrap[],
  trapId: string,
  gridX: number,
  gridY: number,
  thLevel: number,
): PlacedTrap[] | null {
  const trap = getTrapData(trapId);
  if (!trap) return null;
  if (thLevel < trap.thUnlock) return null;

  const maxCount = getMaxTrapCount(trapId, thLevel);
  const currentCount = getCurrentTrapCount(existingTraps, trapId);
  if (currentCount >= maxCount) return null;

  const newTrap: PlacedTrap = {
    instanceId: `trap_${Date.now()}_${existingTraps.length}`,
    trapId,
    level: 1,
    gridX,
    gridY,
    isArmed: true,
  };

  return [...existingTraps, newTrap];
}

/**
 * Upgrades a placed trap by one level.
 * Returns null if the trap is not found in the placed array, if no next level
 * exists in the data, or if the next level's thRequired exceeds the current TH.
 * Otherwise returns the new traps array along with the upgrade cost and time.
 */
export function upgradeTrap(
  traps: PlacedTrap[],
  instanceId: string,
  thLevel: number,
): { traps: PlacedTrap[]; cost: number; time: number } | null {
  const placed = traps.find((t) => t.instanceId === instanceId);
  if (!placed) return null;

  const nextLevel = placed.level + 1;
  const nextStats = getTrapStats(placed.trapId, nextLevel);
  if (!nextStats) return null;
  if (nextStats.thRequired > thLevel) return null;

  const updatedTraps = traps.map((t) =>
    t.instanceId === instanceId ? { ...t, level: nextLevel } : t,
  );

  return {
    traps: updatedTraps,
    cost: nextStats.upgradeCost,
    time: nextStats.upgradeTime,
  };
}

/** Sets isArmed to true for the specified trap. Returns a new array. */
export function rearmTrap(traps: PlacedTrap[], instanceId: string): PlacedTrap[] {
  return traps.map((t) =>
    t.instanceId === instanceId ? { ...t, isArmed: true } : t,
  );
}

/**
 * Cost to rearm a single trap after it fires. Traps rearm for their base
 * (level 1) build cost, so the price never depends on how far a trap has been
 * upgraded. Returns null for unknown traps or traps with no level data.
 */
export function getTrapRearmCost(
  trapId: string,
): { amount: number; resource: TrapLevelStats['upgradeResource'] } | null {
  const stats = getTrapStats(trapId, 1);
  if (!stats) return null;
  return { amount: stats.upgradeCost, resource: stats.upgradeResource };
}

/** All placed traps that have fired and need rearming. */
export function getDisarmedTraps(traps: PlacedTrap[]): PlacedTrap[] {
  return traps.filter((t) => !t.isArmed);
}

/**
 * Total cost to rearm every disarmed trap, grouped by resource. Returns an
 * empty object when nothing needs rearming.
 */
export function getTotalRearmCost(traps: PlacedTrap[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const trap of getDisarmedTraps(traps)) {
    const cost = getTrapRearmCost(trap.trapId);
    if (!cost) continue;
    totals[cost.resource] = (totals[cost.resource] ?? 0) + cost.amount;
  }
  return totals;
}

/** Rearms every disarmed trap in one pass. Returns a new array. */
export function rearmAllTraps(traps: PlacedTrap[]): PlacedTrap[] {
  if (traps.every((t) => t.isArmed)) return traps;
  return traps.map((t) => (t.isArmed ? t : { ...t, isArmed: true }));
}

/** Removes a trap by instanceId. Returns a new filtered array. */
export function removeTrap(traps: PlacedTrap[], instanceId: string): PlacedTrap[] {
  return traps.filter((t) => t.instanceId !== instanceId);
}

/** Returns all trap types unlocked at or before the given TH level. */
export function getAllAvailableTraps(thLevel: number): TrapData[] {
  return trapsData.filter((t) => t.thUnlock <= thLevel);
}
