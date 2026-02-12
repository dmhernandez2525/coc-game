// Gem-based speed-ups and resource purchasing.
// All functions are pure: they return new values, never mutate.

import type { ResourceAmounts } from '../types/village.ts';

// Speed-up breakpoints (seconds to gems) from game data.
// Linear interpolation between each pair of adjacent breakpoints.
const SPEED_UP_BREAKPOINTS: Array<{ seconds: number; gems: number }> = [
  { seconds: 0, gems: 0 },
  { seconds: 60, gems: 1 },
  { seconds: 3_600, gems: 20 },
  { seconds: 86_400, gems: 260 },
  { seconds: 604_800, gems: 1_000 },
];

export interface GemPackage {
  gems: number;
  label: string;
}

export const GEM_PACKAGES: readonly GemPackage[] = [
  { gems: 80, label: 'Handful of Gems' },
  { gems: 500, label: 'Pouch of Gems' },
  { gems: 1_200, label: 'Bag of Gems' },
  { gems: 2_500, label: 'Box of Gems' },
  { gems: 6_500, label: 'Chest of Gems' },
] as const;

const GEMS_PER_RESOURCE = 1_000;

/**
 * Calculates the gem cost to skip a given amount of remaining time.
 * Uses linear interpolation between the defined breakpoints.
 * Returns 0 for 0 seconds. Always rounds up to the nearest integer.
 */
export function calculateSpeedUpCost(remainingSeconds: number): number {
  if (remainingSeconds <= 0) return 0;

  // Find the two breakpoints that bracket the remaining time
  for (let i = 1; i < SPEED_UP_BREAKPOINTS.length; i++) {
    const prev = SPEED_UP_BREAKPOINTS[i - 1]!;
    const curr = SPEED_UP_BREAKPOINTS[i]!;

    if (remainingSeconds <= curr.seconds) {
      const fraction = (remainingSeconds - prev.seconds) / (curr.seconds - prev.seconds);
      return Math.ceil(prev.gems + fraction * (curr.gems - prev.gems));
    }
  }

  // Beyond the last breakpoint: extrapolate from the final segment
  const secondToLast = SPEED_UP_BREAKPOINTS[SPEED_UP_BREAKPOINTS.length - 2]!;
  const last = SPEED_UP_BREAKPOINTS[SPEED_UP_BREAKPOINTS.length - 1]!;
  const rate = (last.gems - secondToLast.gems) / (last.seconds - secondToLast.seconds);
  const extraGems = (remainingSeconds - last.seconds) * rate;
  return Math.ceil(last.gems + extraGems);
}

/**
 * Calculates how much gold and elixir a given number of gems can purchase.
 * Each gem buys 1,000 gold or 1,000 elixir.
 */
export function calculateResourcePurchase(gemCount: number): { gold: number; elixir: number } {
  if (gemCount <= 0) return { gold: 0, elixir: 0 };
  const amount = gemCount * GEMS_PER_RESOURCE;
  return { gold: amount, elixir: amount };
}

/**
 * Attempts to buy resources using gems.
 * Deducts the gem cost and adds the specified amount of the chosen resource.
 * Returns the updated ResourceAmounts, or null if the player lacks sufficient gems.
 */
export function buyResources(
  resources: ResourceAmounts,
  resourceType: 'gold' | 'elixir' | 'darkElixir',
  amount: number,
  gemCost: number,
): ResourceAmounts | null {
  if (gemCost <= 0 || amount <= 0) return null;
  if (resources.gems < gemCost) return null;

  return {
    ...resources,
    gems: resources.gems - gemCost,
    [resourceType]: resources[resourceType] + amount,
  };
}
