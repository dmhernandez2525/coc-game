import type { VillageState } from '../../types/village.ts';
import {
  getLeagueForTrophies,
  getLeagueTier,
  getAllLeagues,
  getTrophyRange,
  calculateLeagueBonus,
  getStarBonus,
  applyTrophyChange,
  calculateTrophyOffer,
  checkLeagueChange,
  processBattleResult,
} from '../trophy-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVillage(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 10,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 100000, elixir: 100000, darkElixir: 1000, gems: 500 },
    builders: [],
    army: [],
    spells: [],
    heroes: [],
    trophies: 0,
    league: 'Unranked',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: Date.now(),
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getLeagueForTrophies
// ---------------------------------------------------------------------------
describe('getLeagueForTrophies', () => {
  it('returns Unranked for 0 trophies', () => {
    expect(getLeagueForTrophies(0)).toBe('Unranked');
  });

  it('returns Unranked for 399 trophies', () => {
    expect(getLeagueForTrophies(399)).toBe('Unranked');
  });

  it('returns Bronze III for 400 trophies', () => {
    expect(getLeagueForTrophies(400)).toBe('Bronze III');
  });

  it('returns Bronze III for 499 trophies', () => {
    expect(getLeagueForTrophies(499)).toBe('Bronze III');
  });

  it('returns Bronze II for 500 trophies', () => {
    expect(getLeagueForTrophies(500)).toBe('Bronze II');
  });

  it('returns Gold III for 1400 trophies', () => {
    expect(getLeagueForTrophies(1400)).toBe('Gold III');
  });

  it('returns Crystal III for 2000 trophies', () => {
    expect(getLeagueForTrophies(2000)).toBe('Crystal III');
  });

  it('returns Champion III for 3200 trophies', () => {
    expect(getLeagueForTrophies(3200)).toBe('Champion III');
  });

  it('returns Titan III for 4100 trophies', () => {
    expect(getLeagueForTrophies(4100)).toBe('Titan III');
  });

  it('returns Legend for 5000 trophies', () => {
    expect(getLeagueForTrophies(5000)).toBe('Legend');
  });

  it('returns Legend for very high trophies', () => {
    expect(getLeagueForTrophies(9999)).toBe('Legend');
  });

  it('returns Unranked for negative trophies', () => {
    expect(getLeagueForTrophies(-50)).toBe('Unranked');
  });
});

// ---------------------------------------------------------------------------
// getLeagueTier
// ---------------------------------------------------------------------------
describe('getLeagueTier', () => {
  it('returns tier data for Gold III', () => {
    const tier = getLeagueTier('Gold III');
    expect(tier).toBeDefined();
    expect(tier!.maxBonusGold).toBe(10000);
    expect(tier!.maxBonusElixir).toBe(10000);
  });

  it('returns tier data for Legend', () => {
    const tier = getLeagueTier('Legend');
    expect(tier).toBeDefined();
    expect(tier!.maxBonusGold).toBe(340000);
  });

  it('returns undefined for unknown league', () => {
    expect(getLeagueTier('FakeLeague')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAllLeagues
// ---------------------------------------------------------------------------
describe('getAllLeagues', () => {
  it('returns all league tiers', () => {
    const leagues = getAllLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    expect(leagues[0]!.league).toBe('Unranked');
    expect(leagues[leagues.length - 1]!.league).toBe('Legend');
  });

  it('returns a copy (not the original array)', () => {
    const a = getAllLeagues();
    const b = getAllLeagues();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// getTrophyRange
// ---------------------------------------------------------------------------
describe('getTrophyRange', () => {
  it('returns range for Bronze III', () => {
    const range = getTrophyRange('Bronze III');
    expect(range).toEqual({ min: 400, max: 499 });
  });

  it('returns range for Legend with Infinity max', () => {
    const range = getTrophyRange('Legend');
    expect(range).toBeDefined();
    expect(range!.min).toBe(5000);
    expect(range!.max).toBe(Infinity);
  });

  it('returns undefined for unknown league', () => {
    expect(getTrophyRange('FakeLeague')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// calculateLeagueBonus
// ---------------------------------------------------------------------------
describe('calculateLeagueBonus', () => {
  it('returns zero bonus for Unranked', () => {
    const bonus = calculateLeagueBonus('Unranked', 100);
    expect(bonus.gold).toBe(0);
    expect(bonus.elixir).toBe(0);
    expect(bonus.darkElixir).toBe(0);
  });

  it('returns full bonus at 70% destruction', () => {
    const bonus = calculateLeagueBonus('Gold III', 70);
    expect(bonus.gold).toBe(10000);
    expect(bonus.elixir).toBe(10000);
  });

  it('returns full bonus at 100% destruction', () => {
    const bonus = calculateLeagueBonus('Gold III', 100);
    expect(bonus.gold).toBe(10000);
  });

  it('returns partial bonus at 50% destruction', () => {
    // 50% * 1.6% per % = 80% of max bonus
    const bonus = calculateLeagueBonus('Gold III', 50);
    expect(bonus.gold).toBe(Math.floor(10000 * 0.80));
  });

  it('returns partial bonus at 25% destruction', () => {
    // 25% * 1.6% = 40% of max bonus
    const bonus = calculateLeagueBonus('Gold III', 25);
    expect(bonus.gold).toBe(Math.floor(10000 * 0.40));
  });

  it('returns partial bonus at 60% destruction', () => {
    // First 50% = 80%, then 10 more % at 1% each = 90%
    const bonus = calculateLeagueBonus('Gold III', 60);
    expect(bonus.gold).toBe(Math.floor(10000 * 0.90));
  });

  it('returns zero bonus at 0% destruction', () => {
    const bonus = calculateLeagueBonus('Gold III', 0);
    expect(bonus.gold).toBe(0);
  });

  it('returns zero for unknown league', () => {
    const bonus = calculateLeagueBonus('FakeLeague', 100);
    expect(bonus.gold).toBe(0);
  });

  it('includes dark elixir bonus in higher leagues', () => {
    const bonus = calculateLeagueBonus('Crystal III', 70);
    expect(bonus.darkElixir).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// getStarBonus
// ---------------------------------------------------------------------------
describe('getStarBonus', () => {
  it('returns star bonus for Gold III', () => {
    const bonus = getStarBonus('Gold III');
    expect(bonus).toBeDefined();
    expect(bonus!.goldElixir).toBeGreaterThan(0);
  });

  it('returns star bonus for Legend', () => {
    const bonus = getStarBonus('Legend');
    expect(bonus).toBeDefined();
    expect(bonus!.goldElixir).toBe(1100000);
    expect(bonus!.darkElixir).toBe(5500);
  });

  it('returns undefined for unknown league', () => {
    expect(getStarBonus('FakeLeague')).toBeUndefined();
  });

  it('returns zero dark elixir for Unranked', () => {
    const bonus = getStarBonus('Unranked');
    expect(bonus).toBeDefined();
    expect(bonus!.darkElixir).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyTrophyChange
// ---------------------------------------------------------------------------
describe('applyTrophyChange', () => {
  it('adds trophies on a win', () => {
    const state = makeVillage({ trophies: 100, league: 'Unranked' });
    const result = applyTrophyChange(state, 30);
    expect(result.trophies).toBe(130);
  });

  it('subtracts trophies on a loss', () => {
    const state = makeVillage({ trophies: 500, league: 'Bronze II' });
    const result = applyTrophyChange(state, -30);
    expect(result.trophies).toBe(470);
  });

  it('never goes below 0 trophies', () => {
    const state = makeVillage({ trophies: 10, league: 'Unranked' });
    const result = applyTrophyChange(state, -50);
    expect(result.trophies).toBe(0);
  });

  it('updates league when crossing a threshold', () => {
    const state = makeVillage({ trophies: 390, league: 'Unranked' });
    const result = applyTrophyChange(state, 20);
    expect(result.trophies).toBe(410);
    expect(result.league).toBe('Bronze III');
  });

  it('demotes league when losing trophies', () => {
    const state = makeVillage({ trophies: 410, league: 'Bronze III' });
    const result = applyTrophyChange(state, -20);
    expect(result.trophies).toBe(390);
    expect(result.league).toBe('Unranked');
  });

  it('does not mutate the original state', () => {
    const state = makeVillage({ trophies: 100, league: 'Unranked' });
    applyTrophyChange(state, 30);
    expect(state.trophies).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateTrophyOffer
// ---------------------------------------------------------------------------
describe('calculateTrophyOffer', () => {
  it('returns ~30 for equal trophies', () => {
    const offer = calculateTrophyOffer(1000, 1000);
    expect(offer).toBe(30);
  });

  it('returns higher offer when defender has more trophies', () => {
    const offer = calculateTrophyOffer(1000, 1500);
    expect(offer).toBeGreaterThan(30);
  });

  it('returns lower offer when attacker has more trophies', () => {
    const offer = calculateTrophyOffer(1500, 1000);
    expect(offer).toBeLessThan(30);
  });

  it('clamps at minimum of 6', () => {
    const offer = calculateTrophyOffer(5000, 100);
    expect(offer).toBe(6);
  });

  it('clamps at maximum of 59', () => {
    const offer = calculateTrophyOffer(100, 5000);
    expect(offer).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// checkLeagueChange
// ---------------------------------------------------------------------------
describe('checkLeagueChange', () => {
  it('returns no change for same league', () => {
    const result = checkLeagueChange('Gold III', 'Gold III');
    expect(result.changed).toBe(false);
    expect(result.promoted).toBe(false);
    expect(result.demoted).toBe(false);
  });

  it('detects promotion', () => {
    const result = checkLeagueChange('Gold III', 'Gold II');
    expect(result.changed).toBe(true);
    expect(result.promoted).toBe(true);
    expect(result.demoted).toBe(false);
  });

  it('detects demotion', () => {
    const result = checkLeagueChange('Gold II', 'Gold III');
    expect(result.changed).toBe(true);
    expect(result.promoted).toBe(false);
    expect(result.demoted).toBe(true);
  });

  it('detects multi-tier promotion', () => {
    const result = checkLeagueChange('Bronze III', 'Gold I');
    expect(result.changed).toBe(true);
    expect(result.promoted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// processBattleResult
// ---------------------------------------------------------------------------
describe('processBattleResult', () => {
  it('updates trophies, league, and calculates bonus on victory', () => {
    const state = makeVillage({ trophies: 1400, league: 'Gold III' });
    const result = processBattleResult(state, 30, 80, 3);

    expect(result.state.trophies).toBe(1430);
    expect(result.leagueBonus.gold).toBe(10000); // Full bonus at 80%
    expect(result.leagueChange.changed).toBe(false); // Still Gold III
  });

  it('does not award league bonus on defeat', () => {
    const state = makeVillage({ trophies: 1400, league: 'Gold III' });
    const result = processBattleResult(state, -30, 20, 0);

    expect(result.state.trophies).toBe(1370);
    expect(result.leagueBonus.gold).toBe(0);
  });

  it('detects league change after trophy update', () => {
    const state = makeVillage({ trophies: 1590, league: 'Gold III' });
    const result = processBattleResult(state, 20, 70, 2);

    expect(result.state.trophies).toBe(1610);
    expect(result.state.league).toBe('Gold II');
    expect(result.leagueChange.changed).toBe(true);
    expect(result.leagueChange.promoted).toBe(true);
  });

  it('handles demotion on trophy loss', () => {
    const state = makeVillage({ trophies: 1405, league: 'Gold III' });
    const result = processBattleResult(state, -30, 10, 0);

    expect(result.state.trophies).toBe(1375);
    expect(result.state.league).toBe('Silver I');
    expect(result.leagueChange.demoted).toBe(true);
  });

  it('does not mutate the original state', () => {
    const state = makeVillage({ trophies: 1000 });
    processBattleResult(state, 30, 50, 2);
    expect(state.trophies).toBe(1000);
  });
});
