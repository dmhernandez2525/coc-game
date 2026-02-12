// Helper functions for village-manager.ts.
// Handles building cost/level lookups and resource deduction.

import type { ResourceType } from '../types/common.ts';
import type { PlacedBuilding, ResourceAmounts, BuilderSlot } from '../types/village.ts';
import { getDefense } from '../data/loaders/defense-loader.ts';
import { getResourceBuilding } from '../data/loaders/resource-loader.ts';
import { getArmyBuilding } from '../data/loaders/army-building-loader.ts';
import { getTownHall } from '../data/loaders/townhall-loader.ts';

// Auto-incrementing counter for generating unique instance IDs.
let nextInstanceId = 1;

/** Reset the instance ID counter (useful for testing). */
export function resetInstanceCounter(startFrom = 1): void {
  nextInstanceId = startFrom;
}

/** Generate a unique instance ID with a "bld_" prefix. */
export function generateInstanceId(): string {
  const id = `bld_${String(nextInstanceId)}`;
  nextInstanceId++;
  return id;
}

const MAX_BUILDERS = 5;

/** Create a fresh BuilderSlot array. Builder 1 is unlocked for free. */
export function createBuilderSlots(): BuilderSlot[] {
  const slots: BuilderSlot[] = [];
  for (let i = 1; i <= MAX_BUILDERS; i++) {
    slots.push({
      id: i,
      isUnlocked: i === 1,
      assignedTo: null,
      timeRemaining: 0,
    });
  }
  return slots;
}

/** Create a PlacedBuilding at the given position with level 1. */
export function makePlacedBuilding(
  buildingId: string,
  buildingType: PlacedBuilding['buildingType'],
  gridX: number,
  gridY: number,
): PlacedBuilding {
  return {
    instanceId: generateInstanceId(),
    buildingId,
    buildingType,
    level: 1,
    gridX,
    gridY,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

/** Information about a building's next upgrade step. */
export interface UpgradeCostInfo {
  cost: number;
  resource: ResourceType;
  time: number;
}

/**
 * Look up the upgrade cost for a building at the given level.
 * The cost listed at level N is the cost to upgrade FROM level N
 * to level N+1. For the initial placement cost, pass level 1.
 *
 * Returns undefined if the building or level is not found.
 */
export function getUpgradeCost(
  buildingId: string,
  level: number,
): UpgradeCostInfo | undefined {
  // Town Hall
  if (buildingId === 'Town Hall') {
    const th = getTownHall(level);
    if (!th) return undefined;
    return {
      cost: th.upgradeCost,
      resource: th.upgradeResource,
      time: th.upgradeTime,
    };
  }

  // Defense buildings
  const defense = getDefense(buildingId);
  if (defense) {
    const stats = defense.levels.find((l) => l.level === level);
    if (!stats) return undefined;
    return {
      cost: stats.upgradeCost,
      resource: stats.upgradeResource,
      time: stats.upgradeTime,
    };
  }

  // Resource buildings (collectors and storages)
  const resourceBuilding = getResourceBuilding(buildingId);
  if (resourceBuilding) {
    const stats = resourceBuilding.levels.find((l) => l.level === level);
    if (!stats) return undefined;
    return {
      cost: stats.upgradeCost,
      resource: stats.upgradeResource,
      time: stats.upgradeTime,
    };
  }

  // Army buildings
  const armyBuilding = getArmyBuilding(buildingId);
  if (armyBuilding) {
    const stats = armyBuilding.levels.find((l) => l.level === level);
    if (!stats) return undefined;
    return {
      cost: stats.upgradeCost,
      resource: stats.upgradeResource,
      time: stats.upgradeTime,
    };
  }

  return undefined;
}

/**
 * Deduct a resource cost from the player's resource pool.
 * Returns a new ResourceAmounts object, or null if the player
 * cannot afford the cost.
 */
export function deductResources(
  resources: ResourceAmounts,
  cost: number,
  resourceType: ResourceType,
): ResourceAmounts | null {
  const mapping: Record<string, keyof ResourceAmounts> = {
    Gold: 'gold',
    Elixir: 'elixir',
    'Dark Elixir': 'darkElixir',
  };

  // "Gold or Elixir" tries gold first, then elixir
  if (resourceType === 'Gold or Elixir') {
    if (resources.gold >= cost) {
      return { ...resources, gold: resources.gold - cost };
    }
    if (resources.elixir >= cost) {
      return { ...resources, elixir: resources.elixir - cost };
    }
    return null;
  }

  const key = mapping[resourceType];
  if (!key) return null;

  const current = resources[key];
  if (current < cost) return null;

  return { ...resources, [key]: current - cost };
}

/**
 * Count how many buildings with a given buildingId exist in the village.
 */
export function countBuildings(
  buildings: PlacedBuilding[],
  buildingId: string,
): number {
  return buildings.filter((b) => b.buildingId === buildingId).length;
}

/**
 * Get the maximum allowed count for a building at the current TH level.
 * Checks the TH buildingCounts first, then falls back to maxCountByTH
 * from the individual building data.
 */
export function getMaxCountForTH(
  buildingId: string,
  thLevel: number,
): number {
  const th = getTownHall(thLevel);
  if (th) {
    const count = th.buildingCounts[buildingId];
    if (count !== undefined) {
      return count;
    }
  }

  // Fallback to individual building data
  const thKey = String(thLevel);

  const defense = getDefense(buildingId);
  if (defense) {
    return defense.maxCountByTH[thKey] ?? 0;
  }

  const resource = getResourceBuilding(buildingId);
  if (resource) {
    return resource.maxCountByTH[thKey] ?? 0;
  }

  const army = getArmyBuilding(buildingId);
  if (army) {
    return army.maxCountByTH[thKey] ?? 0;
  }

  return 0;
}
