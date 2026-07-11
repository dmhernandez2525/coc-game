// Clan War League: a tier ladder the clan climbs by winning wars.
// Wins earn promotion points; losses drain them. Filling the bar promotes
// the clan one tier, emptying it demotes. Higher tiers pay a bigger
// war loot bonus (routed through the treasury with the rest of war loot).
// All functions are pure: they return new state, never mutate.

import type { WarResult } from './clan-war-manager.ts';

// -- Types --

export interface WarLeagueState {
  tierIndex: number;
  promotionPoints: number;
  warsPlayed: number;
}

export interface WarLeagueChange {
  league: WarLeagueState;
  promoted: boolean;
  demoted: boolean;
}

// -- Constants --

export const WAR_LEAGUE_TIERS: readonly string[] = [
  'Bronze League III', 'Bronze League II', 'Bronze League I',
  'Silver League III', 'Silver League II', 'Silver League I',
  'Gold League III', 'Gold League II', 'Gold League I',
  'Crystal League III', 'Crystal League II', 'Crystal League I',
  'Master League III', 'Master League II', 'Master League I',
  'Champion League III', 'Champion League II', 'Champion League I',
];

/** Points needed to fill the promotion bar. */
export const PROMOTION_THRESHOLD = 6;

const RESULT_POINTS: Record<WarResult, number> = {
  victory: 3,
  draw: 1,
  defeat: -2,
};

// After a demotion the clan restarts partway up the bar, not at zero.
const POINTS_AFTER_DEMOTION = 2;

// -- Public API --

/** Fresh war league state: Bronze III with an empty promotion bar. */
export function createWarLeagueState(): WarLeagueState {
  return { tierIndex: 0, promotionPoints: 0, warsPlayed: 0 };
}

/** Display name of the clan's current war league tier. */
export function getWarLeagueTierName(league: WarLeagueState): string {
  const index = Math.min(WAR_LEAGUE_TIERS.length - 1, Math.max(0, league.tierIndex));
  return WAR_LEAGUE_TIERS[index]!;
}

/**
 * War loot bonus multiplier for a tier. Bronze III pays 1.0x;
 * every tier above it adds 5%.
 */
export function getWarLeagueLootMultiplier(tierIndex: number): number {
  const index = Math.min(WAR_LEAGUE_TIERS.length - 1, Math.max(0, tierIndex));
  return 1 + index * 0.05;
}

/** Apply a finished war's result to the league ladder. */
export function applyWarResultToLeague(
  league: WarLeagueState,
  result: WarResult,
): WarLeagueChange {
  const maxTier = WAR_LEAGUE_TIERS.length - 1;
  const points = league.promotionPoints + RESULT_POINTS[result];
  const warsPlayed = league.warsPlayed + 1;

  if (points >= PROMOTION_THRESHOLD && league.tierIndex < maxTier) {
    return {
      league: { tierIndex: league.tierIndex + 1, promotionPoints: 0, warsPlayed },
      promoted: true,
      demoted: false,
    };
  }

  if (points < 0 && league.tierIndex > 0) {
    return {
      league: { tierIndex: league.tierIndex - 1, promotionPoints: POINTS_AFTER_DEMOTION, warsPlayed },
      promoted: false,
      demoted: true,
    };
  }

  // Clamp: no demotion below Bronze III, no banking points past the bar at the top.
  const clamped = Math.min(PROMOTION_THRESHOLD, Math.max(0, points));
  return {
    league: { tierIndex: league.tierIndex, promotionPoints: clamped, warsPlayed },
    promoted: false,
    demoted: false,
  };
}
