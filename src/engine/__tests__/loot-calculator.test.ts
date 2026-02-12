import {
  calculateStorageLoot,
  calculateCollectorLoot,
  applyTHPenalty,
  calculateTotalLoot,
  calculateTrophyChange,
} from '../loot-calculator.ts';
import type { PlacedBuilding, ResourceAmounts, VillageState } from '../../types/village.ts';

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

function makeCollector(
  buildingId: string,
  uncollected?: number,
): PlacedBuilding {
  return {
    instanceId: `test_${buildingId}_${Math.random().toString(36).slice(2, 6)}`,
    buildingId,
    buildingType: 'resource_collector',
    level: 1,
    gridX: 0,
    gridY: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...(uncollected !== undefined ? { uncollectedResources: uncollected } : {}),
  };
}

function makeNonCollectorBuilding(buildingId: string): PlacedBuilding {
  return {
    instanceId: `test_${buildingId}`,
    buildingId,
    buildingType: 'defense',
    level: 1,
    gridX: 0,
    gridY: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

function makeVillageState(overrides: Partial<VillageState> = {}): VillageState {
  return {
    version: 1,
    townHallLevel: overrides.townHallLevel ?? 1,
    buildings: overrides.buildings ?? [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: overrides.resources ?? makeResources(0, 0, 0),
    builders: [],
    army: [],
    spells: [],
    heroes: [],
    trophies: 0,
    league: 'Unranked',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: 0,
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateStorageLoot
// ---------------------------------------------------------------------------

describe('calculateStorageLoot', () => {
  it('takes 20% of gold and elixir at TH1', () => {
    const result = calculateStorageLoot(makeResources(10000, 5000, 0), 1);
    expect(result.gold).toBe(2000);
    expect(result.elixir).toBe(1000);
  });

  it('takes 0% of dark elixir at TH1 (no DE available)', () => {
    const result = calculateStorageLoot(makeResources(1000, 1000, 500), 1);
    expect(result.darkElixir).toBe(0);
  });

  it('floors fractional values', () => {
    const result = calculateStorageLoot(makeResources(333, 777, 0), 1);
    // 333 * 0.20 = 66.6 -> 66
    expect(result.gold).toBe(66);
    // 777 * 0.20 = 155.4 -> 155
    expect(result.elixir).toBe(155);
  });

  it('returns zeros for zero resources', () => {
    const result = calculateStorageLoot(makeResources(0, 0, 0), 5);
    expect(result.gold).toBe(0);
    expect(result.elixir).toBe(0);
    expect(result.darkElixir).toBe(0);
  });

  it('uses TH6 percentages (18% gold/elixir, 6% DE)', () => {
    const result = calculateStorageLoot(makeResources(10000, 10000, 10000), 6);
    expect(result.gold).toBe(1800);
    expect(result.elixir).toBe(1800);
    expect(result.darkElixir).toBe(600);
  });

  it('falls back to TH17 percentages for unknown TH level', () => {
    const result = calculateStorageLoot(makeResources(100000, 100000, 100000), 99);
    // TH17: 4% goldElixir, 3.5% darkElixir
    expect(result.gold).toBe(4000);
    expect(result.elixir).toBe(4000);
    expect(result.darkElixir).toBe(3500);
  });
});

// ---------------------------------------------------------------------------
// calculateCollectorLoot
// ---------------------------------------------------------------------------

describe('calculateCollectorLoot', () => {
  it('takes 50% of uncollected resources from a single gold mine', () => {
    const buildings = [makeCollector('Gold Mine', 1000)];
    const result = calculateCollectorLoot(buildings);
    expect(result.gold).toBe(500);
    expect(result.elixir).toBe(0);
    expect(result.darkElixir).toBe(0);
  });

  it('takes 50% from multiple collector types', () => {
    const buildings = [
      makeCollector('Gold Mine', 2000),
      makeCollector('Elixir Collector', 1000),
      makeCollector('Dark Elixir Drill', 500),
    ];
    const result = calculateCollectorLoot(buildings);
    expect(result.gold).toBe(1000);
    expect(result.elixir).toBe(500);
    expect(result.darkElixir).toBe(250);
  });

  it('sums loot from multiple collectors of the same type', () => {
    const buildings = [
      makeCollector('Gold Mine', 800),
      makeCollector('Gold Mine', 600),
    ];
    const result = calculateCollectorLoot(buildings);
    // 800 * 0.5 = 400, 600 * 0.5 = 300, total = 700
    expect(result.gold).toBe(700);
  });

  it('floors fractional values per collector', () => {
    const buildings = [makeCollector('Gold Mine', 333)];
    const result = calculateCollectorLoot(buildings);
    // 333 * 0.5 = 166.5 -> 166
    expect(result.gold).toBe(166);
  });

  it('skips non-collector buildings entirely', () => {
    const buildings = [
      makeNonCollectorBuilding('Cannon'),
      makeNonCollectorBuilding('Archer Tower'),
      makeCollector('Gold Mine', 400),
    ];
    const result = calculateCollectorLoot(buildings);
    expect(result.gold).toBe(200);
    expect(result.elixir).toBe(0);
    expect(result.darkElixir).toBe(0);
  });

  it('treats undefined uncollectedResources as 0', () => {
    const buildings = [makeCollector('Gold Mine')]; // no uncollected arg
    const result = calculateCollectorLoot(buildings);
    expect(result.gold).toBe(0);
  });

  it('returns all zeros for an empty building list', () => {
    const result = calculateCollectorLoot([]);
    expect(result.gold).toBe(0);
    expect(result.elixir).toBe(0);
    expect(result.darkElixir).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyTHPenalty
// ---------------------------------------------------------------------------

describe('applyTHPenalty', () => {
  const baseLoot = { gold: 1000, elixir: 1000, darkElixir: 1000 };

  it('applies no penalty when attacker TH equals defender TH', () => {
    const result = applyTHPenalty(baseLoot, 5, 5);
    expect(result).toEqual(baseLoot);
  });

  it('applies no penalty when attacker TH is lower than defender TH', () => {
    const result = applyTHPenalty(baseLoot, 3, 8);
    expect(result).toEqual(baseLoot);
  });

  it('applies 90% (diff=1) penalty', () => {
    const result = applyTHPenalty(baseLoot, 6, 5);
    expect(result.gold).toBe(900);
    expect(result.elixir).toBe(900);
    expect(result.darkElixir).toBe(900);
  });

  it('applies 50% (diff=2) penalty', () => {
    const result = applyTHPenalty(baseLoot, 7, 5);
    expect(result.gold).toBe(500);
    expect(result.elixir).toBe(500);
    expect(result.darkElixir).toBe(500);
  });

  it('applies 25% (diff=3) penalty', () => {
    const result = applyTHPenalty(baseLoot, 8, 5);
    expect(result.gold).toBe(250);
    expect(result.elixir).toBe(250);
    expect(result.darkElixir).toBe(250);
  });

  it('applies 5% penalty for diff=4', () => {
    const result = applyTHPenalty(baseLoot, 9, 5);
    expect(result.gold).toBe(50);
    expect(result.elixir).toBe(50);
    expect(result.darkElixir).toBe(50);
  });

  it('applies 5% penalty for diff>=5 (clamped)', () => {
    const result = applyTHPenalty(baseLoot, 15, 5);
    expect(result.gold).toBe(50);
    expect(result.elixir).toBe(50);
    expect(result.darkElixir).toBe(50);
  });

  it('floors penalized values', () => {
    const oddLoot = { gold: 333, elixir: 777, darkElixir: 111 };
    const result = applyTHPenalty(oddLoot, 6, 5); // diff=1, * 0.9
    // 333 * 0.9 = 299.7 -> 299
    expect(result.gold).toBe(299);
    // 777 * 0.9 = 699.3 -> 699
    expect(result.elixir).toBe(699);
    // 111 * 0.9 = 99.9 -> 99
    expect(result.darkElixir).toBe(99);
  });

  it('does not mutate the original loot object', () => {
    const original = { gold: 1000, elixir: 1000, darkElixir: 1000 };
    const copy = { ...original };
    applyTHPenalty(original, 8, 5);
    expect(original).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalLoot
// ---------------------------------------------------------------------------

describe('calculateTotalLoot', () => {
  it('combines storage and collector loot', () => {
    const village = makeVillageState({
      townHallLevel: 1,
      resources: makeResources(10000, 5000, 0),
      buildings: [
        makeCollector('Gold Mine', 2000),
        makeCollector('Elixir Collector', 1000),
      ],
    });
    const result = calculateTotalLoot(village, 1);
    // Storage: 10000 * 0.20 = 2000 gold, 5000 * 0.20 = 1000 elixir
    // Collector: 2000 * 0.5 = 1000 gold, 1000 * 0.5 = 500 elixir
    // Total: 3000 gold, 1500 elixir, 0 DE
    // Attacker TH 1, Defender TH 1: no penalty
    expect(result.gold).toBe(3000);
    expect(result.elixir).toBe(1500);
    expect(result.darkElixir).toBe(0);
  });

  it('applies TH penalty to combined loot', () => {
    const village = makeVillageState({
      townHallLevel: 1,
      resources: makeResources(10000, 10000, 0),
      buildings: [],
    });
    // Attacker TH 3, Defender TH 1: diff=2, multiplier=0.5
    const result = calculateTotalLoot(village, 3);
    // Storage: 10000 * 0.20 = 2000 each
    // Collector: none
    // Penalty: 2000 * 0.5 = 1000 each
    expect(result.gold).toBe(1000);
    expect(result.elixir).toBe(1000);
  });

  it('returns zeros when village has no resources and no collectors', () => {
    const village = makeVillageState({
      townHallLevel: 3,
      resources: makeResources(0, 0, 0),
      buildings: [],
    });
    const result = calculateTotalLoot(village, 3);
    expect(result.gold).toBe(0);
    expect(result.elixir).toBe(0);
    expect(result.darkElixir).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTrophyChange
// ---------------------------------------------------------------------------

describe('calculateTrophyChange', () => {
  it('returns negative trophyOffer for 0 stars (loss)', () => {
    expect(calculateTrophyChange(0, 30)).toBe(-30);
  });

  it('returns 50% of trophyOffer for 1 star', () => {
    expect(calculateTrophyChange(1, 30)).toBe(15);
  });

  it('returns 75% of trophyOffer for 2 stars', () => {
    expect(calculateTrophyChange(2, 30)).toBe(22); // 30 * 0.75 = 22.5 -> 22
  });

  it('returns 100% of trophyOffer for 3 stars', () => {
    expect(calculateTrophyChange(3, 30)).toBe(30);
  });

  it('returns 0 for invalid star counts (e.g. 4)', () => {
    expect(calculateTrophyChange(4, 30)).toBe(0);
  });

  it('returns 0 for negative star counts', () => {
    expect(calculateTrophyChange(-1, 30)).toBe(0);
  });

  it('floors fractional trophy values', () => {
    // 1 star: 25 * 0.5 = 12.5 -> 12
    expect(calculateTrophyChange(1, 25)).toBe(12);
    // 2 stars: 25 * 0.75 = 18.75 -> 18
    expect(calculateTrophyChange(2, 25)).toBe(18);
  });
});
