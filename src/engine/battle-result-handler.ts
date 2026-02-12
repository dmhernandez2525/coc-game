// Battle result handler: applies battle outcomes to village state.
// Bridges the gap between battle engine results and village state updates.
// All functions are pure: they return new state, never mutate.

import type { VillageState, ResourceAmounts } from '../types/village.ts';
import { calculateTotalLoot, calculateTrophyChange } from './loot-calculator.ts';
import { getLeagueForTrophies, getLeagueBonus } from './trophy-manager.ts';
import { getStorageCapacity } from './resource-manager.ts';

// -- Types --

export interface AttackOutcome {
  stars: number;
  destructionPercent: number;
  trophyOffer: number;
  defenderTownHallLevel: number;
  defenderResources: ResourceAmounts;
  defenderBuildings: VillageState['buildings'];
}

export interface DefenseOutcome {
  stars: number;
  trophyOffer: number;
  lostGold: number;
  lostElixir: number;
  lostDarkElixir: number;
}

export interface BattleRewards {
  gold: number;
  elixir: number;
  darkElixir: number;
  trophyChange: number;
  leagueBonusGold: number;
  leagueBonusElixir: number;
  leagueBonusDarkElixir: number;
  newLeague: string;
  starBonusAvailable: boolean;
}

// -- Constants --

const SHIELD_DURATIONS: Record<number, number> = {
  1: 12 * 3600,  // 1 star = 12 hours
  2: 14 * 3600,  // 2 stars = 14 hours
  3: 16 * 3600,  // 3 stars = 16 hours
};

// -- Public API --

/** Calculate all rewards from an attack (before applying to state). */
export function calculateAttackRewards(
  attackerVillage: VillageState,
  outcome: AttackOutcome,
): BattleRewards {
  const loot = calculateTotalLoot(
    {
      ...attackerVillage,
      townHallLevel: outcome.defenderTownHallLevel,
      resources: outcome.defenderResources,
      buildings: outcome.defenderBuildings,
    },
    attackerVillage.townHallLevel,
  );

  const trophyChange = calculateTrophyChange(outcome.stars, outcome.trophyOffer);
  const newTrophies = Math.max(0, attackerVillage.trophies + trophyChange);
  const newLeague = getLeagueForTrophies(newTrophies);

  // League bonus (only awarded for wins with stars > 0)
  let leagueBonusGold = 0;
  let leagueBonusElixir = 0;
  let leagueBonusDarkElixir = 0;

  if (outcome.stars > 0) {
    const bonus = getLeagueBonus(attackerVillage.league);
    if (bonus) {
      leagueBonusGold = bonus.gold;
      leagueBonusElixir = bonus.elixir;
      leagueBonusDarkElixir = bonus.darkElixir;
    }
  }

  return {
    gold: loot.gold,
    elixir: loot.elixir,
    darkElixir: loot.darkElixir,
    trophyChange,
    leagueBonusGold,
    leagueBonusElixir,
    leagueBonusDarkElixir,
    newLeague,
    starBonusAvailable: outcome.stars >= 3,
  };
}

/** Apply attack rewards to the village state. Returns updated state. */
export function applyAttackRewards(
  state: VillageState,
  rewards: BattleRewards,
): VillageState {
  const caps = getStorageCapacity(state);

  const newTrophies = Math.max(0, state.trophies + rewards.trophyChange);
  const totalGold = rewards.gold + rewards.leagueBonusGold;
  const totalElixir = rewards.elixir + rewards.leagueBonusElixir;
  const totalDE = rewards.darkElixir + rewards.leagueBonusDarkElixir;

  const resources: ResourceAmounts = {
    gold: Math.min(state.resources.gold + totalGold, caps.gold),
    elixir: Math.min(state.resources.elixir + totalElixir, caps.elixir),
    darkElixir: Math.min(state.resources.darkElixir + totalDE, caps.darkElixir),
    gems: state.resources.gems,
  };

  return {
    ...state,
    resources,
    trophies: newTrophies,
    league: rewards.newLeague,
  };
}

/** Apply defense losses to the village state. Returns updated state. */
export function applyDefenseLosses(
  state: VillageState,
  outcome: DefenseOutcome,
): VillageState {
  const trophyChange = outcome.stars > 0 ? -calculateTrophyChange(outcome.stars, outcome.trophyOffer) : 0;
  const newTrophies = Math.max(0, state.trophies - Math.abs(trophyChange));

  const resources: ResourceAmounts = {
    gold: Math.max(0, state.resources.gold - outcome.lostGold),
    elixir: Math.max(0, state.resources.elixir - outcome.lostElixir),
    darkElixir: Math.max(0, state.resources.darkElixir - outcome.lostDarkElixir),
    gems: state.resources.gems,
  };

  return {
    ...state,
    resources,
    trophies: newTrophies,
    league: getLeagueForTrophies(newTrophies),
  };
}

/** Get shield duration (seconds) based on stars received in defense. */
export function getShieldDuration(starsReceived: number): number {
  return SHIELD_DURATIONS[starsReceived] ?? 0;
}

/** Check if a star bonus is available (resets daily, simplified as per-battle). */
export function calculateStarBonus(
  trophies: number,
): { gold: number; elixir: number; darkElixir: number } {
  // Star bonus scales with league
  const league = getLeagueForTrophies(trophies);
  const bonus = getLeagueBonus(league);
  if (!bonus) return { gold: 0, elixir: 0, darkElixir: 0 };

  // Star bonus is typically 3-5x the league bonus
  return {
    gold: bonus.gold * 3,
    elixir: bonus.elixir * 3,
    darkElixir: bonus.darkElixir * 3,
  };
}
