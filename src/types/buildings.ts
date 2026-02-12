import type { ResourceType, TargetType, DamageType, BaseLevelStats } from './common';

// Defense buildings (defenses.json, object-map keyed by name)

export interface DefenseLevelStats extends BaseLevelStats {
  dps: number;
  dpshot: number;
}

export interface DefenseBuildingData {
  name: string;
  category: 'defense';
  targetType: TargetType;
  damageType: DamageType | string;
  thUnlock: number;
  range: { min: number; max: number };
  attackSpeed: number;
  tileSize: string;
  specialMechanics: string | null;
  splashRadius?: number;
  maxCountByTH: Record<string, number>;
  levels: DefenseLevelStats[];
}

export type DefensesData = Record<string, DefenseBuildingData>;

// Resource buildings (resources.json, array)

export interface CollectorLevelStats extends BaseLevelStats {
  productionPerHour: number;
  storageCapacity: number;
}

export interface ResourceCollectorData {
  name: string;
  category: 'resource_collector';
  resourceProduced: string;
  thUnlock: number;
  maxCountByTH: Record<string, number>;
  levels: CollectorLevelStats[];
}

export interface StorageLevelStats extends BaseLevelStats {
  capacity: number;
}

export interface ResourceStorageData {
  name: string;
  category: 'resource_storage';
  resourceStored?: string;
  resourceProduced?: string;
  thUnlock: number;
  maxCountByTH: Record<string, number>;
  levels: StorageLevelStats[];
}

export type ResourceBuildingData = ResourceCollectorData | ResourceStorageData;

// Army buildings (army_buildings.json, object-map keyed by name)

export interface ArmyBuildingLevelStats extends BaseLevelStats {
  capacity?: number;
  unlocks?: string[];
  spellCapacity?: number;
  siegeCapacity?: number;
  troopCapacity?: number;
  heroSlots?: number;
}

export interface ArmyBuildingData {
  name: string;
  category: string;
  thUnlock: number;
  maxCountByTH: Record<string, number>;
  levels: ArmyBuildingLevelStats[];
}

export type ArmyBuildingsData = Record<string, ArmyBuildingData>;

// Walls (walls.json, single object)

export interface WallLevelStats {
  level: number;
  hitpoints: number;
  upgradeCost: number;
  upgradeResource: ResourceType;
  thRequired: number;
}

export interface WallData {
  name: string;
  category: 'defense';
  thUnlock: number;
  tileSize: string;
  specialMechanics: string;
  maxSegmentsByTH: Record<string, number>;
  maxLevelByTH: Record<string, number>;
  levels: WallLevelStats[];
}

// Traps (traps.json, array)

export interface TrapLevelStats {
  level: number;
  damage?: number;
  capacity?: number;
  upgradeCost: number;
  upgradeResource: ResourceType;
  upgradeTime: number;
  thRequired: number;
}

export interface TrapData {
  name: string;
  category: string;
  targetType: TargetType;
  damageType: string;
  thUnlock: number;
  triggerRadius: number;
  damageRadius: number | null;
  rearmCost: number;
  tileSize: string;
  specialMechanics: string;
  maxCountByTH: Record<string, number>;
  levels: TrapLevelStats[];
}

// Town Halls (townhalls.json, array)

export interface TownHallData {
  level: number;
  hp: number;
  upgradeCost: number;
  upgradeResource: ResourceType;
  upgradeTime: number;
  xpGained: number;
  unlockedBuildings: {
    defensive: string[];
    resource: string[];
    army: string[];
    other: string[];
  };
  unlockedTraps: string[];
  unlockedTroops: string[];
  unlockedSpells: string[];
  unlockedHeroes: string[];
  maxWalls: number;
  armyCampCapacity: number;
  clanCastleCapacity: {
    troops: number;
    spells: number;
    siegeMachines: number;
  };
  maxStorageCapacity: {
    gold: number;
    elixir: number;
    darkElixir: number;
  };
  buildingCounts: Record<string, number>;
  thWeapon: string | null;
}

// TH Weapons (th_weapons.json, array)

export interface THWeaponStats {
  dpsPerTarget: number;
  damagePerHit: number;
  numberOfTargets: number;
  hitpoints?: number;
  deathDamage: number;
  deathDamageRadius: number;
}

export interface THWeaponData {
  name: string;
  category: string;
  thLevel: number;
  targetType: TargetType;
  damageType: string;
  range: number;
  attackSpeed: number;
  specialMechanics: string;
  note?: string;
  currentStats: THWeaponStats;
  historicalLevels: Array<Record<string, unknown>>;
}
