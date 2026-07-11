// Derives player-facing events by diffing two village snapshots. Used to fire
// toast notifications and advance achievement/statistics counters without the
// UI having to hand-track every transition.
// All functions are pure: they read state, never mutate it.

import type { VillageState } from '../types/village.ts';
import { getStorageCapacity } from './resource-manager.ts';
import { getCurrentHousingUsed, getMaxHousingSpace } from './army-manager.ts';

export type VillageEventType =
  | 'upgrade_complete'
  | 'builders_free'
  | 'army_ready'
  | 'storage_full';

export interface VillageEvent {
  type: VillageEventType;
  /** Human-readable message for a toast. */
  message: string;
  /** How many buildings finished (upgrade_complete only). */
  count?: number;
}

/** Idle (unlocked, unassigned) builders in the village. */
function idleBuilderCount(state: VillageState): number {
  return state.builders.filter((b) => b.isUnlocked && !b.assignedTo).length;
}

/** Buildings that were upgrading in prev and finished (level up) in next. */
export function countCompletedUpgrades(prev: VillageState, next: VillageState): number {
  let completed = 0;
  for (const before of prev.buildings) {
    if (!before.isUpgrading) continue;
    const after = next.buildings.find((b) => b.instanceId === before.instanceId);
    if (after && !after.isUpgrading && after.level > before.level) completed += 1;
  }
  return completed;
}

/** True when every resource storage is at capacity in `state` but was not in `prev`. */
function newlyFullResources(prev: VillageState, next: VillageState): string[] {
  const prevCaps = getStorageCapacity(prev);
  const nextCaps = getStorageCapacity(next);
  const keys: Array<{ key: 'gold' | 'elixir' | 'darkElixir'; label: string }> = [
    { key: 'gold', label: 'Gold' },
    { key: 'elixir', label: 'Elixir' },
    { key: 'darkElixir', label: 'Dark Elixir' },
  ];
  const full: string[] = [];
  for (const { key, label } of keys) {
    const nextCap = nextCaps[key];
    const prevCap = prevCaps[key];
    if (nextCap <= 0) continue;
    const wasFull = prev.resources[key] >= prevCap && prevCap > 0;
    const isFull = next.resources[key] >= nextCap;
    if (isFull && !wasFull) full.push(label);
  }
  return full;
}

/**
 * Compare two village snapshots and return the events that occurred between
 * them. Order: upgrades, freed builders, army ready, storages filled.
 */
export function detectVillageEvents(prev: VillageState, next: VillageState): VillageEvent[] {
  const events: VillageEvent[] = [];

  const completed = countCompletedUpgrades(prev, next);
  if (completed > 0) {
    events.push({
      type: 'upgrade_complete',
      count: completed,
      message: completed === 1 ? 'Upgrade complete!' : `${completed} upgrades complete!`,
    });
  }

  const prevIdle = idleBuilderCount(prev);
  const nextIdle = idleBuilderCount(next);
  if (nextIdle > prevIdle && nextIdle > 0) {
    events.push({ type: 'builders_free', message: 'A builder is now available.' });
  }

  const maxHousing = getMaxHousingSpace(next);
  const usedHousing = getCurrentHousingUsed(next);
  const prevUsed = getCurrentHousingUsed(prev);
  const prevMax = getMaxHousingSpace(prev);
  const wasReady = prevMax > 0 && prevUsed >= prevMax;
  const isReady = maxHousing > 0 && usedHousing >= maxHousing;
  if (isReady && !wasReady) {
    events.push({ type: 'army_ready', message: 'Army ready!' });
  }

  for (const label of newlyFullResources(prev, next)) {
    events.push({ type: 'storage_full', message: `${label} storage is full.` });
  }

  return events;
}
