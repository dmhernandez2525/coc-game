// Equipment management: equip, unequip, upgrade, and stat application.
// All functions are pure: they return new state, never mutate.

import type { HeroEquipmentData, EquipmentLevelStats } from '../types/troops.ts';
import type { OwnedHero } from '../types/village.ts';
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
