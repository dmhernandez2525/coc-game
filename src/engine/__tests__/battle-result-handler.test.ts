import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for dependencies
// ---------------------------------------------------------------------------

vi.mock('../loot-calculator.ts', () => ({
  calculateTotalLoot: vi.fn(() => ({ gold: 5000, elixir: 3000, darkElixir: 100 })),
  calculateTrophyChange: vi.fn((stars: number, trophyOffer: number) => {
    const multipliers: Record<number, number> = { 0: -1, 1: 0.5, 2: 0.75, 3: 1 };
    const mult = multipliers[stars];
    if (mult === undefined) return 0;
    if (stars === 0) return -trophyOffer;
    return Math.floor(trophyOffer * mult);
  }),
}));

vi.mock('../trophy-manager.ts', () => ({
  getLeagueForTrophies: vi.fn((trophies: number) => {
    if (trophies >= 5000) return 'Legend';
    if (trophies >= 4100) return 'Titan III';
    if (trophies >= 3200) return 'Champion III';
    if (trophies >= 2000) return 'Crystal III';
    if (trophies >= 1400) return 'Gold III';
    if (trophies >= 800) return 'Silver III';
    if (trophies >= 400) return 'Bronze III';
    return 'Unranked';
  }),
  getLeagueBonus: vi.fn((league: string) => {
    const bonuses: Record<string, { gold: number; elixir: number; darkElixir: number }> = {
      'Gold III': { gold: 10000, elixir: 10000, darkElixir: 0 },
      'Crystal III': { gold: 40000, elixir: 40000, darkElixir: 120 },
      'Champion III': { gold: 200000, elixir: 200000, darkElixir: 1220 },
      'Legend': { gold: 340000, elixir: 340000, darkElixir: 2400 },
      'Bronze III': { gold: 700, elixir: 700, darkElixir: 0 },
      'Silver III': { gold: 2600, elixir: 2600, darkElixir: 0 },
    };
    return bonuses[league] ?? null;
  }),
}));

vi.mock('../resource-manager.ts', () => ({
  getStorageCapacity: vi.fn(() => ({
    gold: 500000,
    elixir: 500000,
    darkElixir: 10000,
    gems: Infinity,
  })),
}));

import {
  calculateAttackRewards,
  applyAttackRewards,
  applyDefenseLosses,
  getShieldDuration,
  calculateStarBonus,
} from '../battle-result-handler.ts';
import type {
  AttackOutcome,
  DefenseOutcome,
  BattleRewards,
} from '../battle-result-handler.ts';
import type { VillageState, ResourceAmounts } from '../../types/village.ts';
import { calculateTotalLoot, calculateTrophyChange } from '../loot-calculator.ts';
import { getLeagueForTrophies, getLeagueBonus } from '../trophy-manager.ts';
import { getStorageCapacity } from '../resource-manager.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeResources(
  gold: number,
  elixir: number,
  darkElixir: number,
  gems = 0,
): ResourceAmounts {
  return { gold, elixir, darkElixir, gems };
}

function makeVillageState(overrides: Partial<VillageState> = {}): VillageState {
  return {
    version: 1,
    townHallLevel: overrides.townHallLevel ?? 10,
    buildings: overrides.buildings ?? [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: overrides.resources ?? makeResources(100000, 100000, 5000),
    builders: [],
    army: [],
    spells: [],
    heroes: [],
    trophies: overrides.trophies ?? 1500,
    league: overrides.league ?? 'Gold III',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: 0,
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

function makeAttackOutcome(overrides: Partial<AttackOutcome> = {}): AttackOutcome {
  return {
    stars: overrides.stars ?? 3,
    destructionPercent: overrides.destructionPercent ?? 100,
    trophyOffer: overrides.trophyOffer ?? 30,
    defenderTownHallLevel: overrides.defenderTownHallLevel ?? 10,
    defenderResources: overrides.defenderResources ?? makeResources(200000, 200000, 5000),
    defenderBuildings: overrides.defenderBuildings ?? [],
  };
}

function makeDefenseOutcome(overrides: Partial<DefenseOutcome> = {}): DefenseOutcome {
  return {
    stars: overrides.stars ?? 2,
    trophyOffer: overrides.trophyOffer ?? 30,
    lostGold: overrides.lostGold ?? 10000,
    lostElixir: overrides.lostElixir ?? 8000,
    lostDarkElixir: overrides.lostDarkElixir ?? 200,
  };
}

// ---------------------------------------------------------------------------
// calculateAttackRewards
// ---------------------------------------------------------------------------

describe('calculateAttackRewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loot from calculateTotalLoot for a 3-star win', () => {
    const village = makeVillageState();
    const outcome = makeAttackOutcome({ stars: 3, trophyOffer: 30 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.gold).toBe(5000);
    expect(rewards.elixir).toBe(3000);
    expect(rewards.darkElixir).toBe(100);
  });

  it('calculates positive trophy change on a win', () => {
    const village = makeVillageState({ trophies: 1500 });
    const outcome = makeAttackOutcome({ stars: 3, trophyOffer: 30 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.trophyChange).toBe(30);
  });

  it('calculates negative trophy change on a loss (0 stars)', () => {
    const village = makeVillageState({ trophies: 1500 });
    const outcome = makeAttackOutcome({ stars: 0, trophyOffer: 30 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.trophyChange).toBe(-30);
  });

  it('calculates partial trophy change for 1 star', () => {
    const village = makeVillageState({ trophies: 1500 });
    const outcome = makeAttackOutcome({ stars: 1, trophyOffer: 30 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.trophyChange).toBe(15);
  });

  it('calculates partial trophy change for 2 stars', () => {
    const village = makeVillageState({ trophies: 1500 });
    const outcome = makeAttackOutcome({ stars: 2, trophyOffer: 30 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.trophyChange).toBe(22);
  });

  it('includes league bonus for wins (stars > 0)', () => {
    const village = makeVillageState({ league: 'Gold III' });
    const outcome = makeAttackOutcome({ stars: 2 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.leagueBonusGold).toBe(10000);
    expect(rewards.leagueBonusElixir).toBe(10000);
    expect(rewards.leagueBonusDarkElixir).toBe(0);
  });

  it('awards no league bonus on a loss (0 stars)', () => {
    const village = makeVillageState({ league: 'Gold III' });
    const outcome = makeAttackOutcome({ stars: 0 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.leagueBonusGold).toBe(0);
    expect(rewards.leagueBonusElixir).toBe(0);
    expect(rewards.leagueBonusDarkElixir).toBe(0);
  });

  it('awards league bonus with dark elixir in higher leagues', () => {
    const village = makeVillageState({ league: 'Crystal III' });
    const outcome = makeAttackOutcome({ stars: 1 });

    const rewards = calculateAttackRewards(village, outcome);

    expect(rewards.leagueBonusGold).toBe(40000);
    expect(rewards.leagueBonusDarkElixir).toBe(120);
  });

  it('determines the new league based on updated trophies', () => {
    const village = makeVillageState({ trophies: 1390 });
    const outcome = makeAttackOutcome({ stars: 3, trophyOffer: 20 });

    const rewards = calculateAttackRewards(village, outcome);

    // 1390 + 20 = 1410, which falls in Gold III
    expect(rewards.newLeague).toBe('Gold III');
    expect(getLeagueForTrophies).toHaveBeenCalledWith(1410);
  });

  it('sets starBonusAvailable to true only for 3-star attacks', () => {
    const village = makeVillageState();
    const outcome3 = makeAttackOutcome({ stars: 3 });
    const outcome2 = makeAttackOutcome({ stars: 2 });
    const outcome1 = makeAttackOutcome({ stars: 1 });

    expect(calculateAttackRewards(village, outcome3).starBonusAvailable).toBe(true);
    expect(calculateAttackRewards(village, outcome2).starBonusAvailable).toBe(false);
    expect(calculateAttackRewards(village, outcome1).starBonusAvailable).toBe(false);
  });

  it('handles zero league bonus for Unranked league', () => {
    const village = makeVillageState({ league: 'Unranked', trophies: 100 });
    const outcome = makeAttackOutcome({ stars: 3 });

    const rewards = calculateAttackRewards(village, outcome);

    // getLeagueBonus returns null for Unranked
    expect(rewards.leagueBonusGold).toBe(0);
    expect(rewards.leagueBonusElixir).toBe(0);
    expect(rewards.leagueBonusDarkElixir).toBe(0);
  });

  it('clamps trophies at zero when loss would go negative', () => {
    const village = makeVillageState({ trophies: 10 });
    const outcome = makeAttackOutcome({ stars: 0, trophyOffer: 30 });

    const rewards = calculateAttackRewards(village, outcome);

    // trophyChange is -30, but newLeague is derived from Math.max(0, 10 + (-30)) = 0
    expect(getLeagueForTrophies).toHaveBeenCalledWith(0);
    expect(rewards.newLeague).toBe('Unranked');
  });

  it('passes defender state to calculateTotalLoot correctly', () => {
    const village = makeVillageState({ townHallLevel: 10 });
    const defResources = makeResources(300000, 300000, 8000);
    const outcome = makeAttackOutcome({
      defenderTownHallLevel: 8,
      defenderResources: defResources,
      defenderBuildings: [],
    });

    calculateAttackRewards(village, outcome);

    expect(calculateTotalLoot).toHaveBeenCalledWith(
      expect.objectContaining({
        townHallLevel: 8,
        resources: defResources,
        buildings: [],
      }),
      10, // attacker TH level
    );
  });
});

// ---------------------------------------------------------------------------
// applyAttackRewards
// ---------------------------------------------------------------------------

describe('applyAttackRewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds loot and league bonus to village resources', () => {
    const state = makeVillageState({ resources: makeResources(50000, 50000, 1000) });
    const rewards: BattleRewards = {
      gold: 5000,
      elixir: 3000,
      darkElixir: 100,
      trophyChange: 30,
      leagueBonusGold: 10000,
      leagueBonusElixir: 10000,
      leagueBonusDarkElixir: 0,
      newLeague: 'Gold III',
      starBonusAvailable: false,
    };

    const result = applyAttackRewards(state, rewards);

    // gold: 50000 + 5000 + 10000 = 65000
    expect(result.resources.gold).toBe(65000);
    // elixir: 50000 + 3000 + 10000 = 63000
    expect(result.resources.elixir).toBe(63000);
    // darkElixir: 1000 + 100 + 0 = 1100
    expect(result.resources.darkElixir).toBe(1100);
  });

  it('caps resources at storage capacity', () => {
    // Storage capacity is mocked to { gold: 500000, elixir: 500000, darkElixir: 10000 }
    const state = makeVillageState({ resources: makeResources(495000, 499000, 9950) });
    const rewards: BattleRewards = {
      gold: 10000,
      elixir: 5000,
      darkElixir: 200,
      trophyChange: 20,
      leagueBonusGold: 10000,
      leagueBonusElixir: 10000,
      leagueBonusDarkElixir: 0,
      newLeague: 'Gold III',
      starBonusAvailable: false,
    };

    const result = applyAttackRewards(state, rewards);

    // gold: 495000 + 10000 + 10000 = 515000, capped at 500000
    expect(result.resources.gold).toBe(500000);
    // elixir: 499000 + 5000 + 10000 = 514000, capped at 500000
    expect(result.resources.elixir).toBe(500000);
    // darkElixir: 9950 + 200 + 0 = 10150, capped at 10000
    expect(result.resources.darkElixir).toBe(10000);
  });

  it('updates trophies on the village state', () => {
    const state = makeVillageState({ trophies: 1500 });
    const rewards: BattleRewards = {
      gold: 0,
      elixir: 0,
      darkElixir: 0,
      trophyChange: 30,
      leagueBonusGold: 0,
      leagueBonusElixir: 0,
      leagueBonusDarkElixir: 0,
      newLeague: 'Gold III',
      starBonusAvailable: false,
    };

    const result = applyAttackRewards(state, rewards);

    expect(result.trophies).toBe(1530);
  });

  it('updates the league to the new league from rewards', () => {
    const state = makeVillageState({ league: 'Gold III', trophies: 1590 });
    const rewards: BattleRewards = {
      gold: 0,
      elixir: 0,
      darkElixir: 0,
      trophyChange: 20,
      leagueBonusGold: 0,
      leagueBonusElixir: 0,
      leagueBonusDarkElixir: 0,
      newLeague: 'Gold III',
      starBonusAvailable: false,
    };

    const result = applyAttackRewards(state, rewards);

    expect(result.league).toBe('Gold III');
  });

  it('clamps trophies at zero when loss exceeds current trophies', () => {
    const state = makeVillageState({ trophies: 10 });
    const rewards: BattleRewards = {
      gold: 0,
      elixir: 0,
      darkElixir: 0,
      trophyChange: -30,
      leagueBonusGold: 0,
      leagueBonusElixir: 0,
      leagueBonusDarkElixir: 0,
      newLeague: 'Unranked',
      starBonusAvailable: false,
    };

    const result = applyAttackRewards(state, rewards);

    expect(result.trophies).toBe(0);
  });

  it('preserves gems unchanged', () => {
    const state = makeVillageState({ resources: makeResources(50000, 50000, 1000, 250) });
    const rewards: BattleRewards = {
      gold: 5000,
      elixir: 5000,
      darkElixir: 50,
      trophyChange: 10,
      leagueBonusGold: 0,
      leagueBonusElixir: 0,
      leagueBonusDarkElixir: 0,
      newLeague: 'Gold III',
      starBonusAvailable: false,
    };

    const result = applyAttackRewards(state, rewards);

    expect(result.resources.gems).toBe(250);
  });

  it('does not mutate the original state', () => {
    const state = makeVillageState({ trophies: 1500, resources: makeResources(50000, 50000, 1000) });
    const originalTrophies = state.trophies;
    const originalGold = state.resources.gold;

    const rewards: BattleRewards = {
      gold: 10000,
      elixir: 10000,
      darkElixir: 500,
      trophyChange: 30,
      leagueBonusGold: 5000,
      leagueBonusElixir: 5000,
      leagueBonusDarkElixir: 0,
      newLeague: 'Gold III',
      starBonusAvailable: false,
    };

    applyAttackRewards(state, rewards);

    expect(state.trophies).toBe(originalTrophies);
    expect(state.resources.gold).toBe(originalGold);
  });
});

// ---------------------------------------------------------------------------
// applyDefenseLosses
// ---------------------------------------------------------------------------

describe('applyDefenseLosses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reduces resources by the lost amounts', () => {
    const state = makeVillageState({ resources: makeResources(100000, 80000, 3000) });
    const outcome = makeDefenseOutcome({
      stars: 2,
      lostGold: 15000,
      lostElixir: 10000,
      lostDarkElixir: 500,
    });

    const result = applyDefenseLosses(state, outcome);

    expect(result.resources.gold).toBe(85000);
    expect(result.resources.elixir).toBe(70000);
    expect(result.resources.darkElixir).toBe(2500);
  });

  it('clamps resources at zero when losses exceed current amount', () => {
    const state = makeVillageState({ resources: makeResources(5000, 3000, 100) });
    const outcome = makeDefenseOutcome({
      stars: 3,
      lostGold: 20000,
      lostElixir: 10000,
      lostDarkElixir: 500,
    });

    const result = applyDefenseLosses(state, outcome);

    expect(result.resources.gold).toBe(0);
    expect(result.resources.elixir).toBe(0);
    expect(result.resources.darkElixir).toBe(0);
  });

  it('reduces trophies based on the defense outcome', () => {
    const state = makeVillageState({ trophies: 1500 });
    const outcome = makeDefenseOutcome({ stars: 2, trophyOffer: 30 });

    const result = applyDefenseLosses(state, outcome);

    // calculateTrophyChange(2, 30) = floor(30 * 0.75) = 22
    // applyDefenseLosses negates it: trophyChange = -22, then subtracts abs
    // newTrophies = max(0, 1500 - 22) = 1478
    expect(result.trophies).toBe(1478);
  });

  it('does not reduce trophies when 0 stars are earned by attacker', () => {
    const state = makeVillageState({ trophies: 1500 });
    const outcome = makeDefenseOutcome({ stars: 0, trophyOffer: 30 });

    const result = applyDefenseLosses(state, outcome);

    // 0 stars means trophyChange is 0
    expect(result.trophies).toBe(1500);
  });

  it('updates the league after trophy reduction', () => {
    const state = makeVillageState({ trophies: 1410, league: 'Gold III' });
    const outcome = makeDefenseOutcome({ stars: 3, trophyOffer: 30 });

    const result = applyDefenseLosses(state, outcome);

    // calculateTrophyChange(3, 30) = 30, negated to -30
    // newTrophies = max(0, 1410 - 30) = 1380
    expect(result.trophies).toBe(1380);
    expect(getLeagueForTrophies).toHaveBeenCalledWith(1380);
    expect(result.league).toBe('Silver III');
  });

  it('clamps trophies at zero on a large loss', () => {
    const state = makeVillageState({ trophies: 15 });
    const outcome = makeDefenseOutcome({ stars: 3, trophyOffer: 30 });

    const result = applyDefenseLosses(state, outcome);

    expect(result.trophies).toBe(0);
    expect(result.league).toBe('Unranked');
  });

  it('preserves gems unchanged', () => {
    const state = makeVillageState({ resources: makeResources(100000, 100000, 5000, 300) });
    const outcome = makeDefenseOutcome();

    const result = applyDefenseLosses(state, outcome);

    expect(result.resources.gems).toBe(300);
  });

  it('does not mutate the original state', () => {
    const state = makeVillageState({ trophies: 1500, resources: makeResources(100000, 100000, 5000) });
    const originalTrophies = state.trophies;
    const originalGold = state.resources.gold;

    applyDefenseLosses(state, makeDefenseOutcome());

    expect(state.trophies).toBe(originalTrophies);
    expect(state.resources.gold).toBe(originalGold);
  });
});

// ---------------------------------------------------------------------------
// getShieldDuration
// ---------------------------------------------------------------------------

describe('getShieldDuration', () => {
  it('returns 12 hours (43200 seconds) for 1 star', () => {
    expect(getShieldDuration(1)).toBe(12 * 3600);
  });

  it('returns 14 hours (50400 seconds) for 2 stars', () => {
    expect(getShieldDuration(2)).toBe(14 * 3600);
  });

  it('returns 16 hours (57600 seconds) for 3 stars', () => {
    expect(getShieldDuration(3)).toBe(16 * 3600);
  });

  it('returns 0 for 0 stars (no shield)', () => {
    expect(getShieldDuration(0)).toBe(0);
  });

  it('returns 0 for negative star counts', () => {
    expect(getShieldDuration(-1)).toBe(0);
  });

  it('returns 0 for star counts above 3', () => {
    expect(getShieldDuration(4)).toBe(0);
    expect(getShieldDuration(10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateStarBonus
// ---------------------------------------------------------------------------

describe('calculateStarBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 3x the league bonus for Gold III trophies', () => {
    // Gold III league bonus: { gold: 10000, elixir: 10000, darkElixir: 0 }
    const bonus = calculateStarBonus(1500);

    expect(bonus.gold).toBe(30000);
    expect(bonus.elixir).toBe(30000);
    expect(bonus.darkElixir).toBe(0);
  });

  it('returns 3x the league bonus including dark elixir for higher leagues', () => {
    // Crystal III league bonus: { gold: 40000, elixir: 40000, darkElixir: 120 }
    const bonus = calculateStarBonus(2100);

    expect(bonus.gold).toBe(120000);
    expect(bonus.elixir).toBe(120000);
    expect(bonus.darkElixir).toBe(360);
  });

  it('returns zero for 0 trophies (Unranked, no league bonus)', () => {
    const bonus = calculateStarBonus(0);

    expect(bonus.gold).toBe(0);
    expect(bonus.elixir).toBe(0);
    expect(bonus.darkElixir).toBe(0);
  });

  it('scales up significantly at high trophy counts', () => {
    // Champion III at 3200 trophies: { gold: 200000, elixir: 200000, darkElixir: 1220 }
    const bonus = calculateStarBonus(3200);

    expect(bonus.gold).toBe(600000);
    expect(bonus.elixir).toBe(600000);
    expect(bonus.darkElixir).toBe(3660);
  });

  it('returns correct bonus at max trophies (Legend league)', () => {
    // Legend bonus: { gold: 340000, elixir: 340000, darkElixir: 2400 }
    const bonus = calculateStarBonus(5500);

    expect(bonus.gold).toBe(1020000);
    expect(bonus.elixir).toBe(1020000);
    expect(bonus.darkElixir).toBe(7200);
  });

  it('derives the league from the trophy count before looking up bonus', () => {
    calculateStarBonus(1500);

    expect(getLeagueForTrophies).toHaveBeenCalledWith(1500);
    expect(getLeagueBonus).toHaveBeenCalledWith('Gold III');
  });
});
