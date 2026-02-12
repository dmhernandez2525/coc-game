// Centralized upgrade manager for Town Hall progression and content gating.
// All functions are pure: they return new state, never mutate.

import type { VillageState } from '../types/village.ts';
import type { TownHallData } from '../types/buildings.ts';
import { getTownHall, townhalls } from '../data/loaders/townhall-loader.ts';
import { getAvailableBuilder, assignBuilder, freeBuilder } from './builder-manager.ts';
import { deductResources } from './village-helpers.ts';

// -- Public API: TH info --

/** Get the max TH level supported by the game data. */
export function getMaxTownHallLevel(): number {
  return townhalls.reduce((max, th) => Math.max(max, th.level), 0);
}

/** Get the TH data for the next level (or undefined if already max). */
export function getNextTownHallData(currentLevel: number): TownHallData | undefined {
  return getTownHall(currentLevel + 1);
}

/** Check if the player's TH is at the max level. */
export function isTownHallMaxLevel(currentLevel: number): boolean {
  return !getTownHall(currentLevel + 1);
}

/** Get the cost and time to upgrade the Town Hall to the next level. */
export function getTownHallUpgradeCost(
  currentLevel: number,
): { cost: number; resource: string; time: number } | null {
  const nextTH = getTownHall(currentLevel + 1);
  if (!nextTH) return null;
  return {
    cost: nextTH.upgradeCost,
    resource: nextTH.upgradeResource,
    time: nextTH.upgradeTime,
  };
}

// -- Public API: Content gating --

/** Get the list of buildings unlocked at a specific TH level. */
export function getUnlockedBuildings(thLevel: number): TownHallData['unlockedBuildings'] | null {
  const th = getTownHall(thLevel);
  if (!th) return null;
  return th.unlockedBuildings;
}

/** Get the list of troops unlocked at a specific TH level. */
export function getUnlockedTroops(thLevel: number): string[] {
  const th = getTownHall(thLevel);
  if (!th) return [];
  return th.unlockedTroops;
}

/** Get the list of spells unlocked at a specific TH level. */
export function getUnlockedSpells(thLevel: number): string[] {
  const th = getTownHall(thLevel);
  if (!th) return [];
  return th.unlockedSpells;
}

/** Get the list of heroes unlocked at a specific TH level. */
export function getUnlockedHeroes(thLevel: number): string[] {
  const th = getTownHall(thLevel);
  if (!th) return [];
  return th.unlockedHeroes;
}

/** Get all troops available up to and including a TH level. */
export function getAllAvailableTroops(thLevel: number): string[] {
  const troops: string[] = [];
  for (let level = 1; level <= thLevel; level++) {
    const th = getTownHall(level);
    if (th) {
      troops.push(...th.unlockedTroops);
    }
  }
  return troops;
}

/** Get all spells available up to and including a TH level. */
export function getAllAvailableSpells(thLevel: number): string[] {
  const spells: string[] = [];
  for (let level = 1; level <= thLevel; level++) {
    const th = getTownHall(level);
    if (th) {
      spells.push(...th.unlockedSpells);
    }
  }
  return spells;
}

/** Get all heroes available up to and including a TH level. */
export function getAllAvailableHeroes(thLevel: number): string[] {
  const heroes: string[] = [];
  for (let level = 1; level <= thLevel; level++) {
    const th = getTownHall(level);
    if (th) {
      heroes.push(...th.unlockedHeroes);
    }
  }
  return heroes;
}

/** Get max walls allowed at a TH level. */
export function getMaxWalls(thLevel: number): number {
  return getTownHall(thLevel)?.maxWalls ?? 0;
}

/** Get army camp capacity at a TH level. */
export function getArmyCampCapacity(thLevel: number): number {
  return getTownHall(thLevel)?.armyCampCapacity ?? 0;
}

/** Get the TH weapon name for TH13+ (null for lower levels). */
export function getTHWeapon(thLevel: number): string | null {
  return getTownHall(thLevel)?.thWeapon ?? null;
}

// -- Public API: TH upgrade actions --

/**
 * Check if the player can start a TH upgrade.
 * Requirements: not already at max level, has resources, has a free builder,
 * and the current TH is not already upgrading.
 */
export function canStartTownHallUpgrade(state: VillageState): boolean {
  const thBuilding = state.buildings.find((b) => b.buildingId === 'Town Hall');
  if (!thBuilding) return false;
  if (thBuilding.isUpgrading) return false;

  const costInfo = getTownHallUpgradeCost(state.townHallLevel);
  if (!costInfo) return false;

  const canAfford = deductResources(
    state.resources,
    costInfo.cost,
    costInfo.resource as 'Gold' | 'Elixir' | 'Dark Elixir',
  ) !== null;
  if (!canAfford) return false;

  return getAvailableBuilder(state) !== undefined;
}

/**
 * Start upgrading the Town Hall.
 * Deducts resources, assigns a builder, and marks the TH building as upgrading.
 * Returns null if the upgrade cannot start.
 */
export function startTownHallUpgrade(state: VillageState): VillageState | null {
  const thBuilding = state.buildings.find((b) => b.buildingId === 'Town Hall');
  if (!thBuilding) return null;
  if (thBuilding.isUpgrading) return null;

  const costInfo = getTownHallUpgradeCost(state.townHallLevel);
  if (!costInfo) return null;

  const newResources = deductResources(
    state.resources,
    costInfo.cost,
    costInfo.resource as 'Gold' | 'Elixir' | 'Dark Elixir',
  );
  if (!newResources) return null;

  const builder = getAvailableBuilder(state);
  if (!builder) return null;

  let newState: VillageState = {
    ...state,
    resources: newResources,
    buildings: state.buildings.map((b) =>
      b.instanceId === thBuilding.instanceId
        ? {
            ...b,
            isUpgrading: true,
            upgradeTimeRemaining: costInfo.time,
            assignedBuilder: builder.id,
          }
        : b,
    ),
  };

  newState = assignBuilder(newState, builder.id, thBuilding.instanceId, costInfo.time);
  return newState;
}

/**
 * Complete the Town Hall upgrade.
 * Increments the TH level, clears the upgrade state, and frees the builder.
 */
export function completeTownHallUpgrade(state: VillageState): VillageState {
  const thBuilding = state.buildings.find(
    (b) => b.buildingId === 'Town Hall' && b.isUpgrading,
  );
  if (!thBuilding) return state;

  let newState: VillageState = {
    ...state,
    townHallLevel: state.townHallLevel + 1,
    buildings: state.buildings.map((b) =>
      b.instanceId === thBuilding.instanceId
        ? {
            ...b,
            level: b.level + 1,
            isUpgrading: false,
            upgradeTimeRemaining: 0,
            assignedBuilder: null,
          }
        : b,
    ),
  };

  if (thBuilding.assignedBuilder !== null) {
    newState = freeBuilder(newState, thBuilding.assignedBuilder);
  }

  return newState;
}

/**
 * Get a summary of what the next TH level unlocks.
 * Useful for showing the player what they get from upgrading.
 */
export function getNextTHUnlockSummary(currentLevel: number): {
  newBuildings: string[];
  newTroops: string[];
  newSpells: string[];
  newHeroes: string[];
  newTraps: string[];
  wallIncrease: number;
  armyCampCapacityIncrease: number;
} | null {
  const nextTH = getTownHall(currentLevel + 1);
  const currentTH = getTownHall(currentLevel);
  if (!nextTH || !currentTH) return null;

  const allNewBuildings = [
    ...nextTH.unlockedBuildings.defensive,
    ...nextTH.unlockedBuildings.resource,
    ...nextTH.unlockedBuildings.army,
    ...nextTH.unlockedBuildings.other,
  ];

  return {
    newBuildings: allNewBuildings,
    newTroops: nextTH.unlockedTroops,
    newSpells: nextTH.unlockedSpells,
    newHeroes: nextTH.unlockedHeroes,
    newTraps: nextTH.unlockedTraps,
    wallIncrease: nextTH.maxWalls - currentTH.maxWalls,
    armyCampCapacityIncrease: nextTH.armyCampCapacity - currentTH.armyCampCapacity,
  };
}
