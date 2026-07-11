import { useEffect, useRef, useCallback } from 'react';
import type { VillageState } from '../types/village.ts';
import {
  tickResourceProduction,
  collectFromBuilding,
  collectAllResources,
  getStorageCapacity,
} from '../engine/resource-manager.ts';
import { completeUpgrade } from '../engine/village-manager.ts';

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
 * Hook that drives resource production ticks and provides collection actions.
 * Calls onStateUpdate with the new state after each production tick.
 */
export function useResources(
  state: VillageState,
  onStateUpdate: (updater: (prev: VillageState) => VillageState) => void,
) {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // Track real elapsed time so throttled background tabs still produce correctly
    let lastTick = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastTick;
      lastTick = now;
      onStateUpdate((prev) => tickBuildingUpgrades(tickResourceProduction(prev, deltaMs), deltaMs));
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
