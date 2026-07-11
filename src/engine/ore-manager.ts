// Ore economy: earning ores from battles and spending them at the Blacksmith.
// All functions are pure: they return new state, never mutate.

import type { OreAmounts, PlacedBuilding, VillageState } from '../types/village.ts';

// Ore payout tuning: shiny is common, glowy is win-gated, and starry only
// pays out on a perfect three-star raid.
const SHINY_PER_DESTRUCTION_PERCENT = 2;
const SHINY_PER_STAR = 100;
const GLOWY_PER_STAR = 6;
const STARRY_PERFECT_RAID_BONUS = 5;

// -- Public API --

/** Create a zeroed ore wallet. */
export function createEmptyOres(): OreAmounts {
  return { shinyOre: 0, glowyOre: 0, starryOre: 0 };
}

/** Read the village ore wallet, defaulting for saves that predate ores. */
export function getOres(state: VillageState): OreAmounts {
  return state.ores ?? createEmptyOres();
}

/**
 * Calculate the ore reward for a battle. Deterministic: scales with
 * destruction percentage and stars earned.
 */
export function calculateOreReward(stars: number, destructionPercent: number): OreAmounts {
  const destruction = Math.max(0, Math.min(100, Math.round(destructionPercent)));
  const wonStars = Math.max(0, Math.min(3, stars));

  return {
    shinyOre: destruction * SHINY_PER_DESTRUCTION_PERCENT + wonStars * SHINY_PER_STAR,
    glowyOre: wonStars * GLOWY_PER_STAR,
    starryOre: wonStars >= 3 ? STARRY_PERFECT_RAID_BONUS : 0,
  };
}

/** Add earned ores to the current wallet. */
export function addOres(current: OreAmounts, earned: OreAmounts): OreAmounts {
  return {
    shinyOre: current.shinyOre + earned.shinyOre,
    glowyOre: current.glowyOre + earned.glowyOre,
    starryOre: current.starryOre + earned.starryOre,
  };
}

/** Check if the wallet covers a cost. */
export function canAffordOres(current: OreAmounts, cost: OreAmounts): boolean {
  return current.shinyOre >= cost.shinyOre
    && current.glowyOre >= cost.glowyOre
    && current.starryOre >= cost.starryOre;
}

/** Spend ores from the wallet. Returns null when the cost is unaffordable. */
export function spendOres(current: OreAmounts, cost: OreAmounts): OreAmounts | null {
  if (!canAffordOres(current, cost)) return null;
  return {
    shinyOre: current.shinyOre - cost.shinyOre,
    glowyOre: current.glowyOre - cost.glowyOre,
    starryOre: current.starryOre - cost.starryOre,
  };
}

/** Get the placed Blacksmith's level. Returns 0 when it is not built. */
export function getBlacksmithLevel(buildings: PlacedBuilding[]): number {
  return buildings.find((b) => b.buildingId === 'Blacksmith')?.level ?? 0;
}

/** Check whether the village has a Blacksmith to work on equipment. */
export function isBlacksmithBuilt(buildings: PlacedBuilding[]): boolean {
  return getBlacksmithLevel(buildings) > 0;
}
