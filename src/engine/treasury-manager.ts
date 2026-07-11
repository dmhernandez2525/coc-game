// Treasury management: the protected loot pool that holds war loot,
// league bonuses, and star bonuses until the player collects it.
// Only a small percentage is stealable by attackers (3% per game data).
// All functions are pure: they return new state, never mutate.

import type { VillageState, TreasuryAmounts } from '../types/village.ts';
import { economyData } from '../data/loaders/economy-loader.ts';
import { getStorageCapacity } from './resource-manager.ts';

// -- Data --

const treasuryLootData = economyData.treasuryLoot as { percentStealable: number };

/** Fraction of treasury contents an attacker can steal (0.03 = 3%). */
export const TREASURY_STEAL_FRACTION = treasuryLootData.percentStealable / 100;

// Treasury capacity per resource scales with Town Hall level.
const TREASURY_CAPACITY_BY_TH: Record<number, { goldElixir: number; darkElixir: number }> = {
  1: { goldElixir: 100000, darkElixir: 0 },
  2: { goldElixir: 100000, darkElixir: 0 },
  3: { goldElixir: 250000, darkElixir: 0 },
  4: { goldElixir: 400000, darkElixir: 0 },
  5: { goldElixir: 600000, darkElixir: 0 },
  6: { goldElixir: 800000, darkElixir: 2000 },
  7: { goldElixir: 1000000, darkElixir: 4000 },
  8: { goldElixir: 1200000, darkElixir: 6000 },
  9: { goldElixir: 1600000, darkElixir: 8000 },
  10: { goldElixir: 2000000, darkElixir: 10000 },
  11: { goldElixir: 2400000, darkElixir: 12000 },
  12: { goldElixir: 2800000, darkElixir: 14000 },
  13: { goldElixir: 3200000, darkElixir: 16000 },
  14: { goldElixir: 3600000, darkElixir: 18000 },
  15: { goldElixir: 4000000, darkElixir: 20000 },
  16: { goldElixir: 4500000, darkElixir: 22000 },
  17: { goldElixir: 5000000, darkElixir: 25000 },
};

const EMPTY_TREASURY: TreasuryAmounts = { gold: 0, elixir: 0, darkElixir: 0 };

// -- Public API --

/** Create an empty treasury. */
export function createTreasury(): TreasuryAmounts {
  return { ...EMPTY_TREASURY };
}

/** Read the treasury from village state (empty when absent). */
export function getTreasury(state: VillageState): TreasuryAmounts {
  return state.treasury ?? { ...EMPTY_TREASURY };
}

/** Get the per-resource treasury capacity for a Town Hall level. */
export function getTreasuryCapacity(townHallLevel: number): TreasuryAmounts {
  const tier = TREASURY_CAPACITY_BY_TH[townHallLevel] ?? TREASURY_CAPACITY_BY_TH[17]!;
  return { gold: tier.goldElixir, elixir: tier.goldElixir, darkElixir: tier.darkElixir };
}

/**
 * Deposit loot into the treasury, clamped to capacity.
 * War loot, league bonuses, and star bonuses all flow through here.
 */
export function addToTreasury(
  state: VillageState,
  loot: { gold: number; elixir: number; darkElixir: number },
): VillageState {
  const treasury = getTreasury(state);
  const capacity = getTreasuryCapacity(state.townHallLevel);

  return {
    ...state,
    treasury: {
      gold: Math.min(treasury.gold + Math.max(0, loot.gold), capacity.gold),
      elixir: Math.min(treasury.elixir + Math.max(0, loot.elixir), capacity.elixir),
      darkElixir: Math.min(treasury.darkElixir + Math.max(0, loot.darkElixir), capacity.darkElixir),
    },
  };
}

/**
 * Collect the treasury into regular storages. Each resource moves as much
 * as storage space allows; any overflow stays in the treasury.
 */
export function collectTreasury(state: VillageState): VillageState {
  const treasury = getTreasury(state);
  const caps = getStorageCapacity(state);

  const moveGold = Math.min(treasury.gold, Math.max(0, caps.gold - state.resources.gold));
  const moveElixir = Math.min(treasury.elixir, Math.max(0, caps.elixir - state.resources.elixir));
  const moveDark = Math.min(treasury.darkElixir, Math.max(0, caps.darkElixir - state.resources.darkElixir));

  if (moveGold === 0 && moveElixir === 0 && moveDark === 0) return state;

  return {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + moveGold,
      elixir: state.resources.elixir + moveElixir,
      darkElixir: state.resources.darkElixir + moveDark,
    },
    treasury: {
      gold: treasury.gold - moveGold,
      elixir: treasury.elixir - moveElixir,
      darkElixir: treasury.darkElixir - moveDark,
    },
  };
}

/**
 * Calculate how much an attacker can steal from a treasury.
 * Only 3% of contents is stealable (far below the storage steal rate).
 */
export function calculateTreasurySteal(
  treasury: TreasuryAmounts,
): { gold: number; elixir: number; darkElixir: number } {
  return {
    gold: Math.floor(treasury.gold * TREASURY_STEAL_FRACTION),
    elixir: Math.floor(treasury.elixir * TREASURY_STEAL_FRACTION),
    darkElixir: Math.floor(treasury.darkElixir * TREASURY_STEAL_FRACTION),
  };
}

/** Remove the stealable share from the defender's treasury after a raid. */
export function applyTreasurySteal(state: VillageState): VillageState {
  const treasury = getTreasury(state);
  const stolen = calculateTreasurySteal(treasury);
  if (stolen.gold === 0 && stolen.elixir === 0 && stolen.darkElixir === 0) return state;

  return {
    ...state,
    treasury: {
      gold: treasury.gold - stolen.gold,
      elixir: treasury.elixir - stolen.elixir,
      darkElixir: treasury.darkElixir - stolen.darkElixir,
    },
  };
}
