// Derives player-facing toast events by diffing two village snapshots. Pure and
// deterministic: given the same before/after states it always yields the same
// events, so the UI can push them onto the notification queue on every change.

import type { VillageState, ResourceAmounts, BuilderSlot } from '../types/village.ts';
import type { NotificationKind } from './notification-manager.ts';

export interface NotificationEvent {
  kind: NotificationKind;
  message: string;
}

function countIdleBuilders(builders: BuilderSlot[]): number {
  return builders.filter((b) => b.isUnlocked && b.assignedTo === null).length;
}

/** Buildings whose level rose from prev to next (a completed upgrade). */
function upgradeCompletions(prev: VillageState, next: VillageState): NotificationEvent[] {
  const prevLevels = new Map(prev.buildings.map((b) => [b.instanceId, b.level]));
  const events: NotificationEvent[] = [];
  for (const b of next.buildings) {
    const before = prevLevels.get(b.instanceId);
    if (before !== undefined && b.level > before) {
      events.push({ kind: 'success', message: `${b.buildingId} upgraded to level ${b.level}` });
    }
  }
  return events;
}

/** Resources that reached their storage cap on this transition. */
function storageFull(
  prev: VillageState,
  next: VillageState,
  caps: ResourceAmounts,
): NotificationEvent[] {
  const labels: Array<{ key: keyof ResourceAmounts; label: string }> = [
    { key: 'gold', label: 'Gold' },
    { key: 'elixir', label: 'Elixir' },
    { key: 'darkElixir', label: 'Dark Elixir' },
  ];
  const events: NotificationEvent[] = [];
  for (const { key, label } of labels) {
    const cap = caps[key];
    if (cap === Infinity || cap <= 0) continue;
    const wasFull = prev.resources[key] >= cap;
    const isFull = next.resources[key] >= cap;
    if (!wasFull && isFull) {
      events.push({ kind: 'warning', message: `${label} storage full` });
    }
  }
  return events;
}

/**
 * Compare two village snapshots and return the notable events between them:
 * completed upgrades, newly freed builders, and (when caps are supplied) storage
 * hitting its limit. Returns an empty array when nothing noteworthy changed.
 */
export function diffVillageNotifications(
  prev: VillageState,
  next: VillageState,
  caps?: ResourceAmounts,
): NotificationEvent[] {
  const events = upgradeCompletions(prev, next);

  const idleBefore = countIdleBuilders(prev.builders);
  const idleAfter = countIdleBuilders(next.builders);
  if (idleAfter > idleBefore) {
    events.push({ kind: 'info', message: 'Builder available!' });
  }

  if (caps) {
    events.push(...storageFull(prev, next, caps));
  }

  return events;
}
