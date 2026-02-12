// Core village management logic.
// All functions are pure: they return new state objects instead of mutating.

import type { PlacedBuilding, VillageState } from '../types/village.ts';
import { canPlaceBuilding, getBuildingTileSize } from '../utils/collision.ts';
import { getAvailableBuilder, assignBuilder, freeBuilder } from './builder-manager.ts';
import {
  makePlacedBuilding,
  resetInstanceCounter,
  createBuilderSlots,
  getUpgradeCost,
  deductResources,
  countBuildings,
  getMaxCountForTH,
} from './village-helpers.ts';

/**
 * Create a new TH1 starter village with initial buildings placed
 * at sensible grid positions around the center of the 44x44 grid.
 *
 * TH1 buildings: Town Hall, 2x Cannon, Gold Mine, Elixir Collector,
 * Gold Storage, Elixir Storage, Army Camp, Barracks.
 * Starts with 2 builders unlocked.
 */
export function createStarterVillage(): VillageState {
  resetInstanceCounter();

  const buildings: PlacedBuilding[] = [
    makePlacedBuilding('Town Hall', 'other', 20, 20),
    makePlacedBuilding('Gold Mine', 'resource_collector', 16, 20),
    makePlacedBuilding('Elixir Collector', 'resource_collector', 20, 16),
    makePlacedBuilding('Gold Storage', 'resource_storage', 24, 20),
    makePlacedBuilding('Elixir Storage', 'resource_storage', 20, 24),
    makePlacedBuilding('Army Camp', 'army', 15, 15),
    makePlacedBuilding('Barracks', 'army', 25, 15),
    makePlacedBuilding('Cannon', 'defense', 18, 17),
    makePlacedBuilding('Cannon', 'defense', 23, 23),
  ];

  const builders = createBuilderSlots();
  // TH1 starts with 2 builders unlocked
  const buildersWithTwo = builders.map((b) =>
    b.id <= 2 ? { ...b, isUnlocked: true } : b,
  );

  return {
    version: 1,
    townHallLevel: 1,
    buildings,
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 500, elixir: 500, darkElixir: 0, gems: 250 },
    builders: buildersWithTwo,
    army: [],
    spells: [],
    heroes: [],
    trophies: 0,
    league: 'Unranked',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: Date.now(),
    totalPlayTime: 0,
    gameClockSpeed: 1,
  };
}

/**
 * Place a new building in the village.
 * Validates placement, checks TH count limits, and deducts level 1 cost.
 * Returns null if placement is invalid.
 */
export function placeBuilding(
  state: VillageState,
  buildingId: string,
  buildingType: PlacedBuilding['buildingType'],
  gridX: number,
  gridY: number,
): VillageState | null {
  const currentCount = countBuildings(state.buildings, buildingId);
  const maxCount = getMaxCountForTH(buildingId, state.townHallLevel);
  if (currentCount >= maxCount) return null;

  const tileSize = getBuildingTileSize(buildingId);
  if (!canPlaceBuilding(gridX, gridY, tileSize.width, tileSize.height, state.buildings, state.walls)) {
    return null;
  }

  const costInfo = getUpgradeCost(buildingId, 1);
  if (!costInfo) return null;

  const newResources = deductResources(state.resources, costInfo.cost, costInfo.resource);
  if (!newResources) return null;

  const newBuilding = makePlacedBuilding(buildingId, buildingType, gridX, gridY);
  return {
    ...state,
    resources: newResources,
    buildings: [...state.buildings, newBuilding],
  };
}

/** Remove a building from the village by its instanceId. */
export function removeBuilding(
  state: VillageState,
  instanceId: string,
): VillageState {
  return {
    ...state,
    buildings: state.buildings.filter((b) => b.instanceId !== instanceId),
  };
}

/**
 * Move a building to a new grid position.
 * Returns null if the new position is invalid.
 */
export function moveBuilding(
  state: VillageState,
  instanceId: string,
  newGridX: number,
  newGridY: number,
): VillageState | null {
  const building = state.buildings.find((b) => b.instanceId === instanceId);
  if (!building) return null;

  const tileSize = getBuildingTileSize(building.buildingId);
  const otherBuildings = state.buildings.filter((b) => b.instanceId !== instanceId);

  if (!canPlaceBuilding(newGridX, newGridY, tileSize.width, tileSize.height, otherBuildings, state.walls)) {
    return null;
  }

  return {
    ...state,
    buildings: state.buildings.map((b) =>
      b.instanceId === instanceId
        ? { ...b, gridX: newGridX, gridY: newGridY }
        : b,
    ),
  };
}

/**
 * Start upgrading a building. Checks resources, builder availability,
 * and that the building is not already upgrading.
 * Returns null if any check fails.
 */
export function startUpgrade(
  state: VillageState,
  instanceId: string,
): VillageState | null {
  const building = state.buildings.find((b) => b.instanceId === instanceId);
  if (!building) return null;
  if (building.isUpgrading) return null;

  const nextLevel = building.level + 1;
  const costInfo = getUpgradeCost(building.buildingId, nextLevel);
  if (!costInfo) return null;

  const newResources = deductResources(state.resources, costInfo.cost, costInfo.resource);
  if (!newResources) return null;

  const builder = getAvailableBuilder(state);
  if (!builder) return null;

  let newState: VillageState = {
    ...state,
    resources: newResources,
    buildings: state.buildings.map((b) =>
      b.instanceId === instanceId
        ? {
            ...b,
            isUpgrading: true,
            upgradeTimeRemaining: costInfo.time,
            assignedBuilder: builder.id,
          }
        : b,
    ),
  };

  newState = assignBuilder(newState, builder.id, instanceId, costInfo.time);
  return newState;
}

/**
 * Complete a building's upgrade. Increments the level, clears
 * upgrade state, and frees the assigned builder.
 */
export function completeUpgrade(
  state: VillageState,
  instanceId: string,
): VillageState {
  const building = state.buildings.find((b) => b.instanceId === instanceId);
  if (!building) return state;

  let newState: VillageState = {
    ...state,
    buildings: state.buildings.map((b) =>
      b.instanceId === instanceId
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

  if (building.assignedBuilder !== null) {
    newState = freeBuilder(newState, building.assignedBuilder);
  }
  return newState;
}

/** Check whether the player can afford the upgrade from currentLevel. */
export function canAffordUpgrade(
  state: VillageState,
  buildingId: string,
  currentLevel: number,
): boolean {
  const costInfo = getUpgradeCost(buildingId, currentLevel + 1);
  if (!costInfo) return false;
  return deductResources(state.resources, costInfo.cost, costInfo.resource) !== null;
}

/** How many more of this building can be placed at current TH level. */
export function getAvailableBuildingCount(
  state: VillageState,
  buildingId: string,
): number {
  const maxCount = getMaxCountForTH(buildingId, state.townHallLevel);
  const currentCount = countBuildings(state.buildings, buildingId);
  return Math.max(0, maxCount - currentCount);
}
