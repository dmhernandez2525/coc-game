import type { ResourceType, TargetType, DamageType, TroopType, SpellType, EquipmentRarity } from './common';

// Troops (elixir_troops.json = object-map, dark_elixir_troops.json = array)

export interface TroopLevelStats {
  level: number;
  dps: number;
  hp: number;
  damagePerAttack: number;
  upgradeCost: number;
  upgradeResource: ResourceType;
  upgradeTime: number;
  labLevelRequired: number | null;
}

export interface TroopData {
  name: string;
  type: TroopType;
  housingSpace: number;
  movementSpeed: number;
  attackRange: number;
  attackSpeed: number;
  damageType: DamageType | string;
  targetType: TargetType;
  isFlying: boolean;
  favoriteTarget: string | null;
  barracksLevelRequired?: number;
  darkBarracksLevelRequired?: number;
  thUnlock: number;
  specialMechanics: string | null;
  levels: TroopLevelStats[];
}

export type ElixirTroopsData = Record<string, TroopData>;
export type DarkElixirTroopsData = TroopData[];

// Super Troops (super_troops.json, array)

export interface SuperTroopLevelStats {
  level: number;
  dps: number;
  hp: number;
  damagePerAttack: number;
}

export interface SuperTroopData {
  name: string;
  baseTroop: string;
  baseTroopLevelRequired: number;
  thRequired: number;
  housingSpace: number;
  originalHousingSpace: number;
  boostCost: number;
  boostResource: string;
  boostDuration: string;
  specialAbility: string;
  movementSpeed: number;
  attackRange: number;
  attackSpeed: number;
  damageType: DamageType | string;
  targetType: TargetType;
  isFlying: boolean;
  favoriteTarget: string | null;
  levels: SuperTroopLevelStats[];
}

// Spells (elixir_spells.json + dark_spells.json, both arrays)
// Level stats vary per spell type, so we use a base with index signature

export interface SpellLevelStats {
  level: number;
  upgradeCost: number;
  upgradeResource: ResourceType;
  upgradeTime: number;
  labLevelRequired: number | null;
  [key: string]: unknown;
}

export interface SpellData {
  name: string;
  type: SpellType;
  housingSpace: number;
  spellFactoryLevelRequired?: number;
  darkSpellFactoryLevelRequired?: number;
  thUnlock: number;
  radius?: number;
  duration?: number;
  mechanics?: string;
  levels: SpellLevelStats[];
  [key: string]: unknown;
}

// Heroes (heroes.json, object-map keyed by name)

export interface HeroLevelStats {
  level: number;
  dps: number;
  damagePerHit: number;
  hitpoints: number;
  regenerationTimeSeconds: number;
  upgradeCost: number;
  upgradeTimeSeconds: number;
  abilityLevel: number | null;
  heroHallLevelRequired: number;
  townHallRequired: number;
  [key: string]: unknown;
}

export interface HeroData {
  name: string;
  thUnlock: number;
  heroHallLevelRequired: number;
  upgradeResource: ResourceType;
  movementSpeed: number;
  attackRange: number;
  attackSpeed: number;
  isFlying: boolean;
  abilityName: string;
  abilityDescription: string;
  maxLevel: number;
  levels: HeroLevelStats[];
}

export type HeroesData = Record<string, HeroData>;

// Hero Equipment (hero_equipment.json, object-map keyed by name)

export interface EquipmentLevelStats {
  level: number;
  shinyOreCost: number;
  glowyOreCost: number;
  starryOreCost: number;
  blacksmithLevelRequired: number;
  [key: string]: unknown;
}

export interface HeroEquipmentData {
  hero: string;
  rarity: EquipmentRarity;
  maxLevel: number;
  description: string;
  levels: EquipmentLevelStats[];
}

export type HeroEquipmentMap = Record<string, HeroEquipmentData>;

// Pets (pets.json, object-map keyed by name)

export interface PetLevelStats {
  level: number;
  dps: number;
  hp: number;
  upgradeCost: number;
  upgradeTime: number;
  petHouseLevel: number;
}

export interface PetData {
  name: string;
  petHouseLevelRequired: number;
  thUnlock: number;
  upgradeResource: ResourceType;
  movementSpeed: number;
  isFlying: boolean;
  ability: string;
  levels: PetLevelStats[];
}

export type PetsData = Record<string, PetData>;

// Siege Machines (siege_machines.json, array)

export interface SiegeMachineLevelStats {
  level: number;
  dps: number;
  damagePerHit: number;
  hp: number;
  upgradeCost: number;
  upgradeResource: ResourceType;
  upgradeTime: number;
  wallDamagePerHit?: number;
  deathDamage?: number;
  deathDamageRadius?: number;
}

export interface SiegeMachineData {
  name: string;
  workshopLevelRequired: number;
  thUnlock: number;
  housingSpace: number;
  movementSpeed: number;
  attackSpeed: number;
  isFlying: boolean;
  targetBehavior: string;
  specialMechanics: string;
  levels: SiegeMachineLevelStats[];
}
