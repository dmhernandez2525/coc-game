import { useEffect, useCallback } from 'react';
import type { VillageState } from '../types/village.ts';
import {
  tickResourceProduction,
  collectFromBuilding,
  collectAllResources,
  getStorageCapacity,
} from '../engine/resource-manager.ts';
import { completeUpgrade } from '../engine/village-manager.ts';
import { tickHeroRecovery, tickHeroUpgrades } from '../engine/hero-manager.ts';
import { tickVillageSuperTroopBoosts } from '../engine/super-troop-manager.ts';
import { tickPotions, getPotionMultipliers } from '../engine/magic-items-manager.ts';

const TICK_INTERVAL_MS = 1000;

/**
 * Advance in-progress building upgrades by the elapsed time and complete
 * any that reach zero. Pure: returns a new state (or the same state if
 * nothing is upgrading).
 */
export function tickBuildingUpgrades(state: VillageState, deltaMs: number): VillageState {
  const elapsedSeconds = (deltaMs / 1000) * state.gameClockSpeed;
  if (!state.buildings.some((b) => b.isUpgrading)) return state;

  const buildings = state.buildings.map((b) =>
    b.isUpgrading
      ? { ...b, upgradeTimeRemaining: Math.max(0, b.upgradeTimeRemaining - elapsedSeconds) }
      : b,
  );

  let next: VillageState = { ...state, buildings };
  for (const b of buildings) {
    if (b.isUpgrading && b.upgradeTimeRemaining <= 0) {
      next = completeUpgrade(next, b.instanceId);
    }
  }
  return next;
}

/**
 * Advance recovering heroes by the elapsed time so they become available
 * again after battles. Pure: returns the same state when no hero is
 * recovering.
 */
export function tickHeroRecoveryState(state: VillageState, deltaMs: number): VillageState {
  const elapsedSeconds = (deltaMs / 1000) * state.gameClockSpeed;
  const heroes = tickHeroRecovery(state.heroes, elapsedSeconds);
  return heroes === state.heroes ? state : { ...state, heroes };
}

/**
 * Advance upgrading heroes by the elapsed time so they level up and
 * become available again. Pure: returns the same state when no hero is
 * upgrading.
 */
export function tickHeroUpgradeState(state: VillageState, deltaMs: number): VillageState {
  const elapsedSeconds = (deltaMs / 1000) * state.gameClockSpeed;
  const heroes = tickHeroUpgrades(state.heroes, elapsedSeconds);
  return heroes === state.heroes ? state : { ...state, heroes };
}

/**
 * Advance super troop boost timers by the elapsed time (scaled by the game
 * clock) so 3-day boosts expire. Pure: returns the same state when no boost
 * is active.
 */
export function tickSuperTroopBoostState(state: VillageState, deltaMs: number): VillageState {
  return tickVillageSuperTroopBoosts(state, deltaMs * state.gameClockSpeed);
}

/**
 * Run one full village tick: potions first (their multipliers speed up the
 * other systems), then production, upgrades, heroes, and super troop boosts.
 */
export function tickVillage(state: VillageState, deltaMs: number): VillageState {
  const potioned = tickPotions(state, deltaMs);
  const mults = getPotionMultipliers(potioned);

  const produced = tickResourceProduction(potioned, deltaMs * mults.collectorSpeed);
  const built = tickBuildingUpgrades(produced, deltaMs * mults.builderSpeed);
  const recovered = tickHeroRecoveryState(built, deltaMs);
  const upgraded = tickHeroUpgradeState(recovered, deltaMs);
  return tickSuperTroopBoostState(upgraded, deltaMs);
}

/**
 * Hook that drives resource production ticks and provides collection actions.
 * Calls onStateUpdate with the new state after each production tick.
 */
export function useResources(
  state: VillageState,
  onStateUpdate: (updater: (prev: VillageState) => VillageState) => void,
) {
  useEffect(() => {
    // Track real elapsed time so throttled background tabs still produce correctly
    let lastTick = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTick;
      lastTick = now;
      onStateUpdate((prev) => tickVillage(prev, deltaMs));
    }, TICK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [onStateUpdate]);

  const collect = useCallback(
    (instanceId: string) => {
      onStateUpdate((prev) => collectFromBuilding(prev, instanceId));
    },
    [onStateUpdate],
  );

  const collectAll = useCallback(() => {
    onStateUpdate((prev) => collectAllResources(prev));
  }, [onStateUpdate]);

  const storageCaps = getStorageCapacity(state);

  return { collect, collectAll, storageCaps };
}
