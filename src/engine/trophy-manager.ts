// Trophy and league management: track trophies, determine league,
// calculate league bonuses and star bonuses.
// All functions are pure: they return new state, never mutate.

import type { LeagueTier } from '../types/economy.ts';
import type { VillageState } from '../types/village.ts';
import { economyData } from '../data/loaders/economy-loader.ts';

// -- Data --

interface StarBonusEntry {
  league: string;
  goldElixir: number;
  darkElixir: number;
}

const leagueTiers: LeagueTier[] =
  (economyData.leagueBonuses as { leagues: LeagueTier[] }).leagues;

const starBonusByLeague: StarBonusEntry[] =
  (economyData.starBonus as { bonusByLeague: StarBonusEntry[] }).bonusByLeague;

// Parse "400-499" or "5000+" into { min, max } for quick lookup
interface ParsedRange {
  league: string;
  min: number;
  max: number;
}

const parsedRanges: ParsedRange[] = leagueTiers.map((tier) => {
  const range = tier.trophyRange;
  if (range.endsWith('+')) {
    return { league: tier.league, min: parseInt(range, 10), max: Infinity };
  }
  const [minStr, maxStr] = range.split('-');
  return {
    league: tier.league,
    min: parseInt(minStr!, 10),
    max: parseInt(maxStr!, 10),
  };
});

// -- Public API --

/** Determine the league name for a given trophy count. */
export function getLeagueForTrophies(trophies: number): string {
  const safeTrophies = Math.max(0, trophies);
  for (const range of parsedRanges) {
    if (safeTrophies >= range.min && safeTrophies <= range.max) {
      return range.league;
    }
  }
  return 'Unranked';
}

/** Get the LeagueTier data for a given league name. */
export function getLeagueTier(leagueName: string): LeagueTier | undefined {
  return leagueTiers.find((t) => t.league === leagueName);
}

/** Get all league tiers in order. */
export function getAllLeagues(): LeagueTier[] {
  return [...leagueTiers];
}

/** Get the trophy range for a specific league. */
export function getTrophyRange(leagueName: string): { min: number; max: number } | undefined {
  const range = parsedRanges.find((r) => r.league === leagueName);
  if (!range) return undefined;
  return { min: range.min, max: range.max };
}

/**
 * Calculate the league bonus loot for a battle based on destruction percentage.
 *
 * Bonus calculation (from game data):
 * - For every % of destruction up to 50%, each % counts as 1.6% of the max bonus
 * - After 50%, each % up to 70% counts as 1% of the max bonus
 * - At 70%+ destruction, you receive the full (100%) league bonus
 */
export function calculateLeagueBonus(
  leagueName: string,
  destructionPercent: number,
): { gold: number; elixir: number; darkElixir: number } {
  const tier = getLeagueTier(leagueName);
  if (!tier) return { gold: 0, elixir: 0, darkElixir: 0 };

  const clampedPct = Math.min(100, Math.max(0, destructionPercent));
  let bonusFraction: number;

  if (clampedPct >= 70) {
    bonusFraction = 1.0;
  } else if (clampedPct <= 50) {
    // Each % up to 50% counts as 1.6% of max bonus
    bonusFraction = clampedPct * 0.016;
  } else {
    // First 50% = 80% of max bonus (50 * 1.6%)
    // Each additional % counts as 1% of max bonus
    const baseBonus = 50 * 0.016; // 0.80
    const extraPct = clampedPct - 50;
    bonusFraction = baseBonus + extraPct * 0.01;
  }

  return {
    gold: Math.floor(tier.maxBonusGold * bonusFraction),
    elixir: Math.floor(tier.maxBonusElixir * bonusFraction),
    darkElixir: Math.floor(tier.maxBonusDarkElixir * bonusFraction),
  };
}

/** Get the star bonus rewards for a given league. */
export function getStarBonus(
  leagueName: string,
): { goldElixir: number; darkElixir: number } | undefined {
  return starBonusByLeague.find((entry) => entry.league === leagueName);
}

/**
 * Apply a trophy change to the village state.
 * Updates both the trophy count and the league name.
 * Trophies cannot go below 0.
 */
export function applyTrophyChange(
  state: VillageState,
  trophyChange: number,
): VillageState {
  const newTrophies = Math.max(0, state.trophies + trophyChange);
  const newLeague = getLeagueForTrophies(newTrophies);

  return {
    ...state,
    trophies: newTrophies,
    league: newLeague,
  };
}

/**
 * Calculate the trophy offer for a matchup.
 * Based on the difference between attacker and defender trophies.
 * Offer ranges from 6 (attacker much higher) to 59 (attacker much lower).
 * The base offer when trophies are equal is ~30.
 */
export function calculateTrophyOffer(
  attackerTrophies: number,
  defenderTrophies: number,
): number {
  const diff = defenderTrophies - attackerTrophies;
  // Scaled so equal trophies = 30, each 100 trophy difference shifts by ~5
  const offer = 30 + Math.round(diff / 20);
  return Math.min(59, Math.max(6, offer));
}

/** Check whether the player has been promoted to a new league after a battle. */
export function checkLeagueChange(
  oldLeague: string,
  newLeague: string,
): { changed: boolean; promoted: boolean; demoted: boolean } {
  if (oldLeague === newLeague) {
    return { changed: false, promoted: false, demoted: false };
  }

  const oldIndex = leagueTiers.findIndex((t) => t.league === oldLeague);
  const newIndex = leagueTiers.findIndex((t) => t.league === newLeague);

  return {
    changed: true,
    promoted: newIndex > oldIndex,
    demoted: newIndex < oldIndex,
  };
}

/**
 * Process the full trophy result after a battle.
 * Returns updated village state, league bonus loot, and league change info.
 */
export function processBattleResult(
  state: VillageState,
  trophyChange: number,
  destructionPercent: number,
  stars: number,
): {
  state: VillageState;
  leagueBonus: { gold: number; elixir: number; darkElixir: number };
  leagueChange: { changed: boolean; promoted: boolean; demoted: boolean };
} {
  const oldLeague = state.league;

  // Only award league bonus on victories (stars > 0)
  const leagueBonus = stars > 0
    ? calculateLeagueBonus(state.league, destructionPercent)
    : { gold: 0, elixir: 0, darkElixir: 0 };

  const newState = applyTrophyChange(state, trophyChange);
  const leagueChange = checkLeagueChange(oldLeague, newState.league);

  return { state: newState, leagueBonus, leagueChange };
}
