// Army management: troop training, composition, and training queue.
// All functions are pure: they return new state, never mutate.

import type { VillageState, TrainedTroop, ResourceAmounts } from '../types/village.ts';
import type { TroopData } from '../types/troops.ts';
import { getTroop, getAllTroops } from '../data/loaders/troop-loader.ts';
import { getArmyBuilding } from '../data/loaders/army-building-loader.ts';

export interface TrainingQueueItem {
  troopName: string;
  remainingTime: number; // seconds
}

export interface TrainingCost {
  amount: number;
  resource: string;
  time: number; // seconds
}

const RESOURCE_KEY_MAP: Record<string, keyof ResourceAmounts> = {
  Gold: 'gold',
  Elixir: 'elixir',
  'Dark Elixir': 'darkElixir',
};

const TROOP_TYPE_CONFIG: Record<string, {
  costMul: number; timeMul: number; resource: string;
  barracks: string; levelField: 'barracksLevelRequired' | 'darkBarracksLevelRequired';
}> = {
  elixir: { costMul: 50, timeMul: 5, resource: 'Elixir', barracks: 'Barracks', levelField: 'barracksLevelRequired' },
  dark_elixir: { costMul: 20, timeMul: 10, resource: 'Dark Elixir', barracks: 'Dark Barracks', levelField: 'darkBarracksLevelRequired' },
};

// -- Public API --

export function getTrainingCost(troopName: string): TrainingCost | undefined {
  const troop = getTroop(troopName);
  if (!troop) return undefined;

  const cfg = TROOP_TYPE_CONFIG[troop.type];
  if (!cfg) return undefined;

  return {
    amount: troop.housingSpace * cfg.costMul,
    resource: cfg.resource,
    time: troop.housingSpace * cfg.timeMul,
  };
}

export function getMaxHousingSpace(state: VillageState): number {
  const armyCampData = getArmyBuilding('Army Camp');
  if (!armyCampData) return 0;

  let total = 0;
  for (const building of state.buildings) {
    if (building.buildingId !== 'Army Camp') continue;
    const levelData = armyCampData.levels.find((l) => l.level === building.level);
    total += levelData?.capacity ?? 0;
  }
  return total;
}

export function getCurrentHousingUsed(state: VillageState): number {
  let total = 0;
  for (const troop of state.army) {
    const data = getTroop(troop.name);
    if (!data) continue;
    total += troop.count * data.housingSpace;
  }
  return total;
}

export function getAvailableTroops(state: VillageState): TroopData[] {
  const maxBarracksLevels = getMaxBuildingLevels(state);

  return getAllTroops().filter((troop) => {
    if (troop.thUnlock > state.townHallLevel) return false;

    const cfg = TROOP_TYPE_CONFIG[troop.type];
    if (!cfg) return false;

    const required = troop[cfg.levelField];
    if (required === undefined) return true;

    const maxLevel = maxBarracksLevels.get(cfg.barracks) ?? 0;
    return maxLevel >= required;
  });
}

export function trainTroop(state: VillageState, troopName: string): VillageState | null {
  const troop = getTroop(troopName);
  if (!troop) return null;

  // Check troop is available at this TH/barracks level
  const available = getAvailableTroops(state);
  if (!available.some((t) => t.name === troopName)) return null;

  // Check housing space
  const maxSpace = getMaxHousingSpace(state);
  const usedSpace = getCurrentHousingUsed(state);
  if (usedSpace + troop.housingSpace > maxSpace) return null;

  // Check and deduct training cost
  const cost = getTrainingCost(troopName);
  if (!cost) return null;

  const resourceKey = RESOURCE_KEY_MAP[cost.resource];
  if (!resourceKey) return null;
  if (state.resources[resourceKey] < cost.amount) return null;

  const resources: ResourceAmounts = {
    ...state.resources,
    [resourceKey]: state.resources[resourceKey] - cost.amount,
  };

  // Update army
  const existingIndex = state.army.findIndex((t) => t.name === troopName);
  let army: TrainedTroop[];
  if (existingIndex >= 0) {
    army = state.army.map((t, i) =>
      i === existingIndex ? { ...t, count: t.count + 1 } : t,
    );
  } else {
    army = [...state.army, { name: troopName, level: 1, count: 1 }];
  }

  return { ...state, resources, army };
}

export function removeTroop(
  state: VillageState,
  troopName: string,
  count: number = 1,
): VillageState {
  const army = state.army
    .map((t) => {
      if (t.name !== troopName) return t;
      return { ...t, count: t.count - count };
    })
    .filter((t) => t.count > 0);

  return { ...state, army };
}

export function getLabLevel(state: VillageState): number {
  const lab = state.buildings.find((b) => b.buildingId === 'Laboratory');
  return lab?.level ?? 0;
}

export function canResearchTroop(
  state: VillageState,
  troopName: string,
  currentLevel: number,
): boolean {
  const labLevel = getLabLevel(state);
  if (labLevel === 0) return false;

  const troop = getTroop(troopName);
  if (!troop) return false;

  // The next level data is at index currentLevel (0-indexed array, so level 2 is index 1)
  const nextLevelData = troop.levels[currentLevel];
  if (!nextLevelData) return false;

  if (nextLevelData.labLevelRequired !== null && nextLevelData.labLevelRequired > labLevel) {
    return false;
  }

  const resourceKey = RESOURCE_KEY_MAP[nextLevelData.upgradeResource];
  if (!resourceKey) return false;

  return state.resources[resourceKey] >= nextLevelData.upgradeCost;
}

// -- Internal helpers --

function getMaxBuildingLevels(state: VillageState): Map<string, number> {
  const levels = new Map<string, number>();
  for (const building of state.buildings) {
    const current = levels.get(building.buildingId) ?? 0;
    if (building.level > current) {
      levels.set(building.buildingId, building.level);
    }
  }
  return levels;
}
