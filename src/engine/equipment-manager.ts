// Equipment management: equip, unequip, upgrade, and stat application.
// All functions are pure: they return new state, never mutate.

import type { HeroEquipmentData, EquipmentLevelStats } from '../types/troops.ts';
import type { OwnedHero } from '../types/village.ts';
import type { DeployedTroop, HeroBattleBoost } from '../types/battle.ts';
import { getEquipment, heroEquipment } from '../data/loaders/hero-loader.ts';

// -- Types --

export interface OwnedEquipment {
  name: string;
  level: number;
}

export interface EquipmentBonuses {
  hitpointIncrease: number;
  damageIncrease: number;
  hpRecovery: number;
  speedIncrease: number;
}

export interface UpgradeCost {
  shinyOre: number;
  glowyOre: number;
  starryOre: number;
}

// -- Public API --

/** Get all equipment items that belong to a specific hero. */
export function getEquipmentForHero(heroName: string): HeroEquipmentData[] {
  return Object.values(heroEquipment).filter((eq) => eq.hero === heroName);
}

/** Get the level stats for an equipment item at a given level. */
export function getEquipmentStats(
  equipmentName: string, level: number,
): EquipmentLevelStats | undefined {
  const eq = getEquipment(equipmentName);
  if (!eq) return undefined;
  return eq.levels.find((l) => l.level === level);
}

/** Check if equipment can be equipped on the given hero. */
export function canEquipOnHero(equipmentName: string, heroName: string): boolean {
  const eq = getEquipment(equipmentName);
  return eq?.hero === heroName;
}

/**
 * Equip an item in a slot (0 or 1) on a hero.
 * Returns the updated hero, or null if the equipment is incompatible.
 */
export function equipItem(
  hero: OwnedHero, slotIndex: 0 | 1, equipmentName: string,
): OwnedHero | null {
  if (!canEquipOnHero(equipmentName, hero.name)) return null;

  // Cannot equip the same item in both slots
  const otherSlot = slotIndex === 0 ? 1 : 0;
  if (hero.equippedItems[otherSlot] === equipmentName) return null;

  const updated: [string | null, string | null] = [...hero.equippedItems];
  updated[slotIndex] = equipmentName;
  return { ...hero, equippedItems: updated };
}

/** Unequip the item in the given slot. */
export function unequipItem(hero: OwnedHero, slotIndex: 0 | 1): OwnedHero {
  const updated: [string | null, string | null] = [...hero.equippedItems];
  updated[slotIndex] = null;
  return { ...hero, equippedItems: updated };
}

/** Get the cost to upgrade equipment from its current level to the next. */
export function getUpgradeCost(
  equipmentName: string, currentLevel: number,
): UpgradeCost | null {
  const eq = getEquipment(equipmentName);
  if (!eq) return null;

  const nextLevel = currentLevel + 1;
  const nextStats = eq.levels.find((l) => l.level === nextLevel);
  if (!nextStats) return null; // Already at max level

  return {
    shinyOre: nextStats.shinyOreCost,
    glowyOre: nextStats.glowyOreCost,
    starryOre: nextStats.starryOreCost,
  };
}

/** Check whether an ore wallet covers the next upgrade's cost. */
export function canAffordUpgrade(
  equipmentName: string,
  currentLevel: number,
  ores: { shinyOre: number; glowyOre: number; starryOre: number },
): boolean {
  const cost = getUpgradeCost(equipmentName, currentLevel);
  if (!cost) return false;
  return ores.shinyOre >= cost.shinyOre
    && ores.glowyOre >= cost.glowyOre
    && ores.starryOre >= cost.starryOre;
}

/** Get the blacksmith level required to upgrade to the next level. */
export function getBlacksmithRequirement(
  equipmentName: string, currentLevel: number,
): number | null {
  const eq = getEquipment(equipmentName);
  if (!eq) return null;

  const nextStats = eq.levels.find((l) => l.level === currentLevel + 1);
  return nextStats?.blacksmithLevelRequired ?? null;
}

/**
 * Upgrade an equipment item by one level.
 * Returns the updated equipment list, or null if upgrade is not possible.
 */
export function upgradeEquipment(
  ownedEquipment: OwnedEquipment[],
  equipmentName: string,
  ores: { shinyOre: number; glowyOre: number; starryOre: number },
  blacksmithLevel: number,
): { equipment: OwnedEquipment[]; remainingOres: typeof ores } | null {
  const idx = ownedEquipment.findIndex((e) => e.name === equipmentName);
  if (idx === -1) return null;

  const current = ownedEquipment[idx]!;
  const cost = getUpgradeCost(equipmentName, current.level);
  if (!cost) return null; // At max level

  const bsReq = getBlacksmithRequirement(equipmentName, current.level);
  if (bsReq !== null && blacksmithLevel < bsReq) return null;

  if (ores.shinyOre < cost.shinyOre || ores.glowyOre < cost.glowyOre || ores.starryOre < cost.starryOre) {
    return null; // Not enough ores
  }

  const upgraded = ownedEquipment.map((e, i) =>
    i === idx ? { ...e, level: e.level + 1 } : e,
  );

  return {
    equipment: upgraded,
    remainingOres: {
      shinyOre: ores.shinyOre - cost.shinyOre,
      glowyOre: ores.glowyOre - cost.glowyOre,
      starryOre: ores.starryOre - cost.starryOre,
    },
  };
}

/**
 * Upgrade an equipment item by one level, seeding a level 1 entry when the
 * item has never been upgraded before. Same contract as upgradeEquipment.
 */
export function upgradeOwnedEquipment(
  ownedEquipment: OwnedEquipment[],
  equipmentName: string,
  ores: { shinyOre: number; glowyOre: number; starryOre: number },
  blacksmithLevel: number,
): { equipment: OwnedEquipment[]; remainingOres: typeof ores } | null {
  if (!getEquipment(equipmentName)) return null;

  const withEntry = ownedEquipment.some((e) => e.name === equipmentName)
    ? ownedEquipment
    : [...ownedEquipment, { name: equipmentName, level: 1 }];

  return upgradeEquipment(withEntry, equipmentName, ores, blacksmithLevel);
}

/** Parse a numeric stat from equipment level data, handling percentage strings. */
function parseNumericStat(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace('%', ''));
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Calculate the combined stat bonuses from a hero's equipped items.
 * Reads equipment data from both slots and sums the bonuses.
 */
export function getEquipmentBonuses(
  hero: OwnedHero, equipmentLevels: Record<string, number>,
): EquipmentBonuses {
  const bonuses: EquipmentBonuses = {
    hitpointIncrease: 0,
    damageIncrease: 0,
    hpRecovery: 0,
    speedIncrease: 0,
  };

  for (const itemName of hero.equippedItems) {
    if (!itemName) continue;
    const level = equipmentLevels[itemName] ?? 1;
    const stats = getEquipmentStats(itemName, level);
    if (!stats) continue;

    bonuses.hitpointIncrease += parseNumericStat(stats['hitpointIncrease']);
    bonuses.damageIncrease += parseNumericStat(stats['damageIncrease']);
    bonuses.hpRecovery += parseNumericStat(stats['hpRecovery']);
    bonuses.speedIncrease += parseNumericStat(stats['speedIncrease']);
  }

  return bonuses;
}

/** Split a damage stat that may be flat (number) or percent ("18%" string). */
function splitDamageStat(value: unknown): { flat: number; percent: number } {
  if (typeof value === 'number') return { flat: value, percent: 0 };
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const pct = parseFloat(value);
    return Number.isNaN(pct) ? { flat: 0, percent: 0 } : { flat: 0, percent: pct };
  }
  return { flat: 0, percent: 0 };
}

// Equipment data uses several key spellings for the same kind of stat.
const HP_STAT_KEYS = ['hitpointIncrease', 'hpIncrease'] as const;
const DAMAGE_STAT_KEYS = ['damageIncrease', 'dpsIncrease'] as const;

/**
 * Build the battle boost a hero gains from its equipped items.
 * Flat HP/speed stats add directly; percentage damage stats multiply.
 */
export function getHeroBattleBoost(
  hero: OwnedHero, equipmentLevels: Record<string, number>,
): HeroBattleBoost {
  const boost: HeroBattleBoost = {
    hitpointIncrease: 0,
    dpsIncrease: 0,
    dpsMultiplier: 1,
    speedIncrease: 0,
  };

  for (const itemName of hero.equippedItems) {
    if (!itemName) continue;
    const level = equipmentLevels[itemName] ?? 1;
    const stats = getEquipmentStats(itemName, level);
    if (!stats) continue;

    for (const key of HP_STAT_KEYS) {
      boost.hitpointIncrease += parseNumericStat(stats[key]);
    }
    for (const key of DAMAGE_STAT_KEYS) {
      const damage = splitDamageStat(stats[key]);
      boost.dpsIncrease += damage.flat;
      boost.dpsMultiplier *= 1 + damage.percent / 100;
    }
    boost.speedIncrease += parseNumericStat(stats['speedIncrease']);
  }

  return boost;
}

/** Apply an equipment boost to a deployed hero. Returns a new troop. */
export function applyBattleBoost(
  troop: DeployedTroop, boost: HeroBattleBoost,
): DeployedTroop {
  const dps = Math.round((troop.dps + boost.dpsIncrease) * boost.dpsMultiplier);
  const baseDps = Math.round((troop.baseDps + boost.dpsIncrease) * boost.dpsMultiplier);
  return {
    ...troop,
    currentHp: troop.currentHp + boost.hitpointIncrease,
    maxHp: troop.maxHp + boost.hitpointIncrease,
    dps,
    baseDps,
    movementSpeed: troop.movementSpeed + boost.speedIncrease,
  };
}

/** Check if an equipment item is at its max level. */
export function isMaxLevel(equipmentName: string, currentLevel: number): boolean {
  const eq = getEquipment(equipmentName);
  if (!eq) return true;
  return currentLevel >= eq.maxLevel;
}

/** Get the max level for an equipment item. */
export function getMaxLevel(equipmentName: string): number {
  return getEquipment(equipmentName)?.maxLevel ?? 0;
}
