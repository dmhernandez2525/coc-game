import { describe, it, expect } from 'vitest';
import type { WarLeagueState } from '../war-league-manager.ts';
import {
  WAR_LEAGUE_TIERS,
  PROMOTION_THRESHOLD,
  createWarLeagueState,
  getWarLeagueTierName,
  getWarLeagueLootMultiplier,
  applyWarResultToLeague,
} from '../war-league-manager.ts';

function makeLeague(overrides?: Partial<WarLeagueState>): WarLeagueState {
  return { tierIndex: 5, promotionPoints: 0, warsPlayed: 0, ...overrides };
}

// ---------------------------------------------------------------------------
// Tier table
// ---------------------------------------------------------------------------

describe('WAR_LEAGUE_TIERS', () => {
  it('has 18 tiers from Bronze III to Champion I', () => {
    expect(WAR_LEAGUE_TIERS).toHaveLength(18);
    expect(WAR_LEAGUE_TIERS[0]).toBe('Bronze League III');
    expect(WAR_LEAGUE_TIERS[17]).toBe('Champion League I');
  });
});

// ---------------------------------------------------------------------------
// createWarLeagueState / getWarLeagueTierName
// ---------------------------------------------------------------------------

describe('createWarLeagueState', () => {
  it('starts at Bronze III with an empty promotion bar', () => {
    const league = createWarLeagueState();
    expect(league.tierIndex).toBe(0);
    expect(league.promotionPoints).toBe(0);
    expect(league.warsPlayed).toBe(0);
    expect(getWarLeagueTierName(league)).toBe('Bronze League III');
  });
});

describe('getWarLeagueTierName', () => {
  it('returns the tier name for a mid-ladder state', () => {
    expect(getWarLeagueTierName(makeLeague({ tierIndex: 6 }))).toBe('Gold League III');
  });

  it('clamps out-of-range tier indexes', () => {
    expect(getWarLeagueTierName(makeLeague({ tierIndex: -3 }))).toBe('Bronze League III');
    expect(getWarLeagueTierName(makeLeague({ tierIndex: 99 }))).toBe('Champion League I');
  });
});

// ---------------------------------------------------------------------------
// getWarLeagueLootMultiplier
// ---------------------------------------------------------------------------

describe('getWarLeagueLootMultiplier', () => {
  it('pays 1.0x at the bottom tier', () => {
    expect(getWarLeagueLootMultiplier(0)).toBe(1);
  });

  it('adds 5% per tier', () => {
    expect(getWarLeagueLootMultiplier(4)).toBeCloseTo(1.2);
    expect(getWarLeagueLootMultiplier(17)).toBeCloseTo(1.85);
  });

  it('clamps out-of-range tier indexes', () => {
    expect(getWarLeagueLootMultiplier(-5)).toBe(1);
    expect(getWarLeagueLootMultiplier(99)).toBeCloseTo(1.85);
  });
});

// ---------------------------------------------------------------------------
// applyWarResultToLeague
// ---------------------------------------------------------------------------

describe('applyWarResultToLeague', () => {
  it('adds 3 points for a victory', () => {
    const change = applyWarResultToLeague(makeLeague(), 'victory');
    expect(change.league.promotionPoints).toBe(3);
    expect(change.promoted).toBe(false);
    expect(change.demoted).toBe(false);
  });

  it('adds 1 point for a draw', () => {
    const change = applyWarResultToLeague(makeLeague(), 'draw');
    expect(change.league.promotionPoints).toBe(1);
  });

  it('never drops points below zero without a demotion at the bottom tier', () => {
    const change = applyWarResultToLeague(makeLeague({ tierIndex: 0 }), 'defeat');
    expect(change.league.tierIndex).toBe(0);
    expect(change.league.promotionPoints).toBe(0);
    expect(change.demoted).toBe(false);
  });

  it('promotes one tier when the bar fills and resets points', () => {
    const change = applyWarResultToLeague(
      makeLeague({ promotionPoints: PROMOTION_THRESHOLD - 3 }),
      'victory',
    );
    expect(change.promoted).toBe(true);
    expect(change.league.tierIndex).toBe(6);
    expect(change.league.promotionPoints).toBe(0);
  });

  it('two consecutive victories promote from a fresh tier', () => {
    const first = applyWarResultToLeague(makeLeague(), 'victory');
    const second = applyWarResultToLeague(first.league, 'victory');
    expect(second.promoted).toBe(true);
    expect(second.league.tierIndex).toBe(6);
  });

  it('demotes one tier when points go negative and grants grace points', () => {
    const change = applyWarResultToLeague(
      makeLeague({ promotionPoints: 1 }),
      'defeat',
    );
    expect(change.demoted).toBe(true);
    expect(change.league.tierIndex).toBe(4);
    expect(change.league.promotionPoints).toBe(2);
  });

  it('does not promote past the top tier', () => {
    const change = applyWarResultToLeague(
      makeLeague({ tierIndex: 17, promotionPoints: PROMOTION_THRESHOLD - 1 }),
      'victory',
    );
    expect(change.promoted).toBe(false);
    expect(change.league.tierIndex).toBe(17);
    expect(change.league.promotionPoints).toBe(PROMOTION_THRESHOLD);
  });

  it('increments warsPlayed on every result', () => {
    const first = applyWarResultToLeague(makeLeague(), 'draw');
    const second = applyWarResultToLeague(first.league, 'defeat');
    expect(second.league.warsPlayed).toBe(2);
  });

  it('does not mutate the input state', () => {
    const league = makeLeague({ promotionPoints: 1 });
    applyWarResultToLeague(league, 'victory');
    expect(league.promotionPoints).toBe(1);
    expect(league.warsPlayed).toBe(0);
  });
});
