// Core resource production and collection engine.
// All functions are pure: they return new state, never mutate.

import type { VillageState, PlacedBuilding, ResourceAmounts } from '../types/village.ts';
import type { CollectorLevelStats, StorageLevelStats, ResourceCollectorData, ResourceStorageData } from '../types/buildings.ts';
import { getCollectors, getStorages } from '../data/loaders/resource-loader.ts';
import { getTownHall } from '../data/loaders/townhall-loader.ts';

const MS_PER_HOUR = 3_600_000;

const RESOURCE_KEY_MAP: Record<string, keyof ResourceAmounts> = {
  Gold: 'gold',
  Elixir: 'elixir',
  'Dark Elixir': 'darkElixir',
};

const NAME_TO_KEY: Record<string, keyof ResourceAmounts> = {
  'Gold Storage': 'gold',
  'Elixir Storage': 'elixir',
  'Dark Elixir Storage': 'darkElixir',
};

function findCollectorData(building: PlacedBuilding): ResourceCollectorData | undefined {
  return getCollectors().find((c) => c.name === building.buildingId);
}

export function getCollectorStats(building: PlacedBuilding): CollectorLevelStats | undefined {
  if (building.buildingType !== 'resource_collector') return undefined;
  const data = findCollectorData(building);
  if (!data) return undefined;
  return data.levels.find((l) => l.level === building.level);
}

export function getProductionPerMs(building: PlacedBuilding): number {
  const stats = getCollectorStats(building);
  if (!stats) return 0;
  return stats.productionPerHour / MS_PER_HOUR;
}

export function getCollectorCapacity(building: PlacedBuilding): number {
  const stats = getCollectorStats(building);
  if (!stats) return 0;
  return stats.storageCapacity;
}

export function tickResourceProduction(state: VillageState, deltaMs: number): VillageState {
  const buildings = state.buildings.map((b) => {
    if (b.buildingType !== 'resource_collector') return b;
    if (b.isUpgrading) return b;

    const rate = getProductionPerMs(b);
    if (rate === 0) return b;

    const capacity = getCollectorCapacity(b);
    const current = b.uncollectedResources ?? 0;
    const produced = deltaMs * rate * state.gameClockSpeed;
    const capped = Math.min(current + produced, capacity);

    return { ...b, uncollectedResources: capped };
  });

  return { ...state, buildings };
}

function getStorageResourceKey(storage: ResourceStorageData): keyof ResourceAmounts | undefined {
  if (storage.resourceStored) return RESOURCE_KEY_MAP[storage.resourceStored];
  return NAME_TO_KEY[storage.name];
}

function getStorageLevelCapacity(storage: ResourceStorageData, level: number): number {
  const stats: StorageLevelStats | undefined = storage.levels.find((l) => l.level === level);
  if (!stats) return 0;
  return stats.capacity;
}

export function getStorageCapacity(state: VillageState): ResourceAmounts {
  const caps: ResourceAmounts = { gold: 0, elixir: 0, darkElixir: 0, gems: Infinity };

  // Sum capacity from all placed storage buildings
  for (const building of state.buildings) {
    if (building.buildingType !== 'resource_storage') continue;

    const data = getStorages().find((s) => s.name === building.buildingId);
    if (!data) continue;

    const key = getStorageResourceKey(data);
    if (!key || key === 'gems') continue;

    caps[key] += getStorageLevelCapacity(data, building.level);
  }

  // Add Town Hall bonus storage (counted once)
  const th = getTownHall(state.townHallLevel);
  if (th) {
    caps.gold += th.maxStorageCapacity.gold;
    caps.elixir += th.maxStorageCapacity.elixir;
    caps.darkElixir += th.maxStorageCapacity.darkElixir;
  }

  return caps;
}

export function collectFromBuilding(state: VillageState, instanceId: string): VillageState {
  const buildingIndex = state.buildings.findIndex((b) => b.instanceId === instanceId);
  if (buildingIndex === -1) return state;

  const building = state.buildings[buildingIndex]!;
  if (building.buildingType !== 'resource_collector') return state;

  const uncollected = building.uncollectedResources ?? 0;
  if (uncollected <= 0) return state;

  const collectorData = findCollectorData(building);
  if (!collectorData) return state;

  const key = RESOURCE_KEY_MAP[collectorData.resourceProduced];
  if (!key || key === 'gems') return state;

  const caps = getStorageCapacity(state);
  const currentAmount = state.resources[key];
  const maxForResource = caps[key];
  const added = Math.min(uncollected, maxForResource - currentAmount);
  const actualAdded = Math.max(added, 0);

  const updatedBuilding: PlacedBuilding = {
    ...building,
    uncollectedResources: 0,
    lastCollectionTime: Date.now(),
  };

  const buildings = state.buildings.map((b, i) => (i === buildingIndex ? updatedBuilding : b));
  const resources: ResourceAmounts = {
    ...state.resources,
    [key]: currentAmount + actualAdded,
  };

  return { ...state, buildings, resources };
}

export function collectAllResources(state: VillageState): VillageState {
  let current = state;
  for (const building of state.buildings) {
    if (building.buildingType !== 'resource_collector') continue;
    current = collectFromBuilding(current, building.instanceId);
  }
  return current;
}
