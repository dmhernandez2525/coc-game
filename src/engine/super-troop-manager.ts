// Super troop management: boost/unboost, timer, modified stats.
// All functions are pure: they return new state, never mutate.

import type { SuperTroopData } from '../types/troops.ts';
import type { VillageState, ActiveSuperTroopBoost } from '../types/village.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { superTroops } from '../data/loaders/economy-loader.ts';

// -- Types --

export type SuperTroopBoost = ActiveSuperTroopBoost;

export interface SuperTroopState {
  activeBoosts: SuperTroopBoost[];
}

// -- Constants --

const MAX_ACTIVE_BOOSTS = 2;
const BOOST_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const MIN_TH_FOR_SUPER_TROOPS = 11;

// -- Public API --

/** Create an empty super troop state. */
export function createSuperTroopState(): SuperTroopState {
  return { activeBoosts: [] };
}

/** Get all available super troop data. */
export function getAllSuperTroops(): SuperTroopData[] {
  return [...superTroops];
}

/** Get super troop data by name. */
export function getSuperTroop(name: string): SuperTroopData | undefined {
  return superTroops.find((st) => st.name === name);
}

/** Get the super troop variant for a base troop (if one exists). */
export function getSuperVariant(baseTroopName: string): SuperTroopData | undefined {
  return superTroops.find((st) => st.baseTroop === baseTroopName);
}

/** Check if a super troop can be boosted. */
export function canBoost(
  state: SuperTroopState,
  superTroopName: string,
  thLevel: number,
  availableDarkElixir: number,
): boolean {
  if (thLevel < MIN_TH_FOR_SUPER_TROOPS) return false;
  if (state.activeBoosts.length >= MAX_ACTIVE_BOOSTS) return false;

  const superData = getSuperTroop(superTroopName);
  if (!superData) return false;

  // Check if the base troop exists
  const baseTroop = getTroop(superData.baseTroop);
  if (!baseTroop) return false;

  // Check TH requirement
  if (superData.thRequired > thLevel) return false;

  // Check not already boosted
  if (state.activeBoosts.some((b) => b.superTroopName === superTroopName)) return false;

  // Check not already boosting the same base troop
  if (state.activeBoosts.some((b) => b.baseTroopName === superData.baseTroop)) return false;

  // Check dark elixir cost
  return availableDarkElixir >= superData.boostCost;
}

/**
 * Boost a super troop. Returns updated state and DE cost, or null if not possible.
 */
export function boostSuperTroop(
  state: SuperTroopState,
  superTroopName: string,
  thLevel: number,
  availableDarkElixir: number,
): { state: SuperTroopState; cost: number } | null {
  if (!canBoost(state, superTroopName, thLevel, availableDarkElixir)) return null;

  const superData = getSuperTroop(superTroopName);
  if (!superData) return null;

  const newBoost: SuperTroopBoost = {
    baseTroopName: superData.baseTroop,
    superTroopName,
    remainingDurationMs: BOOST_DURATION_MS,
  };

  return {
    state: {
      ...state,
      activeBoosts: [...state.activeBoosts, newBoost],
    },
    cost: superData.boostCost,
  };
}

/** Remove an expired or cancelled super troop boost. */
export function unboostSuperTroop(
  state: SuperTroopState,
  superTroopName: string,
): SuperTroopState {
  return {
    ...state,
    activeBoosts: state.activeBoosts.filter((b) => b.superTroopName !== superTroopName),
  };
}

/** Tick all boost timers by the given delta. Removes expired boosts. */
export function tickSuperTroopTimers(
  state: SuperTroopState,
  deltaMs: number,
): SuperTroopState {
  const activeBoosts = state.activeBoosts
    .map((b) => ({ ...b, remainingDurationMs: b.remainingDurationMs - deltaMs }))
    .filter((b) => b.remainingDurationMs > 0);

  return { ...state, activeBoosts };
}

/** Check if a base troop is currently boosted to its super variant. */
export function isTroopBoosted(
  state: SuperTroopState,
  baseTroopName: string,
): boolean {
  return state.activeBoosts.some((b) => b.baseTroopName === baseTroopName);
}

/** Get the active super troop name for a base troop (if boosted). */
export function getActiveSuperTroop(
  state: SuperTroopState,
  baseTroopName: string,
): string | undefined {
  return state.activeBoosts.find((b) => b.baseTroopName === baseTroopName)?.superTroopName;
}

// -- Village state integration --

/** Read the super troop state stored on the village (empty when absent). */
export function getVillageSuperTroopState(state: VillageState): SuperTroopState {
  return { activeBoosts: state.superTroopBoosts ?? [] };
}

/** Write a super troop state back onto the village. */
export function withSuperTroopState(
  state: VillageState,
  superTroopState: SuperTroopState,
): VillageState {
  return { ...state, superTroopBoosts: superTroopState.activeBoosts };
}

/**
 * Boost a super troop directly on the village state, paying the dark elixir
 * cost. Returns the updated village, or null if the boost is not possible.
 */
export function boostVillageSuperTroop(
  state: VillageState,
  superTroopName: string,
): VillageState | null {
  const result = boostSuperTroop(
    getVillageSuperTroopState(state),
    superTroopName,
    state.townHallLevel,
    state.resources.darkElixir,
  );
  if (!result) return null;

  return withSuperTroopState(
    {
      ...state,
      resources: {
        ...state.resources,
        darkElixir: state.resources.darkElixir - result.cost,
      },
    },
    result.state,
  );
}

/** Cancel an active boost on the village state (no refund). */
export function unboostVillageSuperTroop(
  state: VillageState,
  superTroopName: string,
): VillageState {
  return withSuperTroopState(
    state,
    unboostSuperTroop(getVillageSuperTroopState(state), superTroopName),
  );
}

/**
 * Advance boost timers on the village state by game-clock time.
 * Expired boosts are removed. Returns the same state when nothing is active.
 */
export function tickVillageSuperTroopBoosts(
  state: VillageState,
  deltaMs: number,
): VillageState {
  const boosts = state.superTroopBoosts ?? [];
  if (boosts.length === 0) return state;

  const ticked = tickSuperTroopTimers({ activeBoosts: boosts }, deltaMs);
  return { ...state, superTroopBoosts: ticked.activeBoosts };
}

/** Get the active super troop name for a base troop on the village state. */
export function getVillageActiveSuperTroop(
  state: VillageState,
  baseTroopName: string,
): string | undefined {
  return getActiveSuperTroop(getVillageSuperTroopState(state), baseTroopName);
}

/** Get the boost duration constant. */
export function getBoostDurationMs(): number {
  return BOOST_DURATION_MS;
}

/** Get max active boosts. */
export function getMaxActiveBoosts(): number {
  return MAX_ACTIVE_BOOSTS;
}
