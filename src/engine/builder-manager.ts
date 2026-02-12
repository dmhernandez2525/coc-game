// Builder allocation and management.
// All functions are pure: they return new state objects instead of mutating.

import type { VillageState, BuilderSlot } from '../types/village.ts';
import { buildersData } from '../data/loaders/economy-loader.ts';
import { gemsAndItemsData } from '../data/loaders/economy-loader.ts';

// Pre-extract builder costs from the JSON data for quick lookup.
// The builderCosts array is indexed by (builder number - 1).
const builderCosts: Array<{ builder: number; cost: number }> =
  (
    buildersData.builderHuts.builderCosts as Array<{
      builder: number;
      cost: number;
      costType: string;
    }>
  ).map((entry) => ({
    builder: entry.builder,
    cost: entry.cost,
  }));

// Gem speedup breakpoints from the game data.
const gemBreakpoints: Array<{ seconds: number; gemCost: number }> =
  (
    gemsAndItemsData.gemSpeedUpCosts.breakpoints as Array<{
      seconds: number;
      gemCost: number;
    }>
  ).map((bp) => ({
    seconds: bp.seconds,
    gemCost: bp.gemCost,
  }));

const MAX_REGULAR_BUILDERS = 5;

/** Find the first idle (unlocked and unassigned) builder slot. */
export function getAvailableBuilder(
  state: VillageState,
): BuilderSlot | undefined {
  return state.builders.find(
    (b) => b.isUnlocked && b.assignedTo === null,
  );
}

/**
 * Assign a builder to a construction/upgrade task.
 * Returns a new VillageState with the builder's assignment updated.
 */
export function assignBuilder(
  state: VillageState,
  builderId: number,
  buildingInstanceId: string,
  duration: number,
): VillageState {
  return {
    ...state,
    builders: state.builders.map((b) =>
      b.id === builderId
        ? { ...b, assignedTo: buildingInstanceId, timeRemaining: duration }
        : b,
    ),
  };
}

/**
 * Free a builder after their task completes.
 * Returns a new VillageState with the builder idle again.
 */
export function freeBuilder(
  state: VillageState,
  builderId: number,
): VillageState {
  return {
    ...state,
    builders: state.builders.map((b) =>
      b.id === builderId
        ? { ...b, assignedTo: null, timeRemaining: 0 }
        : b,
    ),
  };
}

/** Count how many builders are idle vs total unlocked. */
export function getBuilderCount(
  state: VillageState,
): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const builder of state.builders) {
    if (!builder.isUnlocked) continue;
    total++;
    if (builder.assignedTo === null) {
      idle++;
    }
  }
  return { idle, total };
}

/**
 * Check whether the player can unlock the next builder.
 * Requires: there is a locked builder slot remaining, and the
 * player has enough gems to pay for it.
 */
export function canUnlockBuilder(state: VillageState): boolean {
  const { total } = getBuilderCount(state);
  if (total >= MAX_REGULAR_BUILDERS) return false;

  const nextBuilderNumber = total + 1;
  const costEntry = builderCosts.find(
    (entry) => entry.builder === nextBuilderNumber,
  );
  if (!costEntry) return false;

  return state.resources.gems >= costEntry.cost;
}

/**
 * Unlock the next builder slot by spending gems.
 * Returns null if the player cannot afford it or no slots remain.
 */
export function unlockBuilder(
  state: VillageState,
): VillageState | null {
  const { total } = getBuilderCount(state);
  if (total >= MAX_REGULAR_BUILDERS) return null;

  const nextBuilderNumber = total + 1;
  const costEntry = builderCosts.find(
    (entry) => entry.builder === nextBuilderNumber,
  );
  if (!costEntry) return null;
  if (state.resources.gems < costEntry.cost) return null;

  return {
    ...state,
    resources: {
      ...state.resources,
      gems: state.resources.gems - costEntry.cost,
    },
    builders: state.builders.map((b) =>
      b.id === nextBuilderNumber ? { ...b, isUnlocked: true } : b,
    ),
  };
}

/**
 * Calculate the gem cost to instantly finish a timer with the given
 * number of remaining seconds. Uses linear interpolation between
 * the game's breakpoints (1 min, 1 hour, 1 day, 1 week).
 *
 * Timers shorter than 1 minute are free (0 gems).
 * Timers longer than 1 week extrapolate from the last two breakpoints.
 */
export function calculateGemSpeedup(remainingSeconds: number): number {
  if (remainingSeconds <= 0) return 0;

  // Shorter than the first breakpoint: scale linearly from 0
  const firstBp = gemBreakpoints[0];
  if (!firstBp) return 0;

  if (remainingSeconds <= firstBp.seconds) {
    // Pro-rate: e.g. 30 seconds out of 60 = 0.5 gems, round up to 1
    return Math.max(
      1,
      Math.ceil((remainingSeconds / firstBp.seconds) * firstBp.gemCost),
    );
  }

  // Find the two breakpoints that bracket the remaining time
  for (let i = 1; i < gemBreakpoints.length; i++) {
    const lower = gemBreakpoints[i - 1];
    const upper = gemBreakpoints[i];
    if (!lower || !upper) continue;

    if (remainingSeconds <= upper.seconds) {
      const fraction =
        (remainingSeconds - lower.seconds) /
        (upper.seconds - lower.seconds);
      const cost = lower.gemCost + fraction * (upper.gemCost - lower.gemCost);
      return Math.ceil(cost);
    }
  }

  // Beyond the last breakpoint: extrapolate using the last segment's rate
  const secondToLast = gemBreakpoints[gemBreakpoints.length - 2];
  const last = gemBreakpoints[gemBreakpoints.length - 1];
  if (!secondToLast || !last) return 0;

  const rate =
    (last.gemCost - secondToLast.gemCost) /
    (last.seconds - secondToLast.seconds);
  const extraTime = remainingSeconds - last.seconds;
  return Math.ceil(last.gemCost + rate * extraTime);
}
