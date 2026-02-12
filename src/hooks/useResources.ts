import { useEffect, useRef, useCallback } from 'react';
import type { VillageState } from '../types/village.ts';
import {
  tickResourceProduction,
  collectFromBuilding,
  collectAllResources,
  getStorageCapacity,
} from '../engine/resource-manager.ts';

const TICK_INTERVAL_MS = 1000;

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
    const id = setInterval(() => {
      onStateUpdate((prev) => tickResourceProduction(prev, TICK_INTERVAL_MS));
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
