import type { VillageState, PlacedBuilding } from '../../types/village.ts';
import {
  getCollectorStats,
  getProductionPerMs,
  getCollectorCapacity,
  tickResourceProduction,
  getStorageCapacity,
  collectFromBuilding,
  collectAllResources,
} from '../resource-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 1,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
    builders: [{ id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 }],
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

function makeCollector(name: string, overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: `test_${name}`,
    buildingId: name,
    buildingType: 'resource_collector',
    level: 1,
    gridX: 10,
    gridY: 10,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeStorage(name: string, overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: `test_${name}`,
    buildingId: name,
    buildingType: 'resource_storage',
    level: 1,
    gridX: 20,
    gridY: 20,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

// Constants matching the JSON game data
const MS_PER_HOUR = 3_600_000;
const GOLD_MINE_L1_RATE = 200; // productionPerHour
const GOLD_MINE_L1_CAP = 1000; // storageCapacity
const GOLD_STORAGE_L1_CAP = 1500; // capacity
const TH1_GOLD_CAP = 1000; // maxStorageCapacity.gold for TH1
const TH1_ELIXIR_CAP = 1000;

// ---------------------------------------------------------------------------
// getCollectorStats
// ---------------------------------------------------------------------------
describe('getCollectorStats', () => {
  it('returns level stats for a Gold Mine level 1', () => {
    const mine = makeCollector('Gold Mine');
    const stats = getCollectorStats(mine);

    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.productionPerHour).toBe(GOLD_MINE_L1_RATE);
    expect(stats!.storageCapacity).toBe(GOLD_MINE_L1_CAP);
  });

  it('returns undefined for a non-collector building type', () => {
    const storage = makeStorage('Gold Storage');
    const stats = getCollectorStats(storage);

    expect(stats).toBeUndefined();
  });

  it('returns undefined for an unknown building name', () => {
    const fake = makeCollector('Nonexistent Building');
    const stats = getCollectorStats(fake);

    expect(stats).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getProductionPerMs
// ---------------------------------------------------------------------------
describe('getProductionPerMs', () => {
  it('returns the correct rate for Gold Mine level 1', () => {
    const mine = makeCollector('Gold Mine');
    const rate = getProductionPerMs(mine);

    expect(rate).toBeCloseTo(GOLD_MINE_L1_RATE / MS_PER_HOUR, 10);
  });

  it('returns 0 for a non-collector building type', () => {
    const storage = makeStorage('Gold Storage');
    const rate = getProductionPerMs(storage);

    expect(rate).toBe(0);
  });

  it('returns 0 for an unknown building name', () => {
    const fake = makeCollector('Mystery Building');
    const rate = getProductionPerMs(fake);

    expect(rate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCollectorCapacity
// ---------------------------------------------------------------------------
describe('getCollectorCapacity', () => {
  it('returns 1000 for Gold Mine level 1', () => {
    const mine = makeCollector('Gold Mine');
    const cap = getCollectorCapacity(mine);

    expect(cap).toBe(GOLD_MINE_L1_CAP);
  });

  it('returns 0 for a non-collector building type', () => {
    const storage = makeStorage('Gold Storage');
    const cap = getCollectorCapacity(storage);

    expect(cap).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tickResourceProduction
// ---------------------------------------------------------------------------
describe('tickResourceProduction', () => {
  it('produces resources after 1 hour', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 0 });
    const state = makeState({ buildings: [mine] });

    const result = tickResourceProduction(state, MS_PER_HOUR);
    const updatedMine = result.buildings[0]!;

    expect(updatedMine.uncollectedResources).toBeCloseTo(GOLD_MINE_L1_RATE, 5);
  });

  it('caps production at collector storage capacity', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 0 });
    const state = makeState({ buildings: [mine] });

    // 10 hours of production: 200 * 10 = 2000, but cap is 1000
    const result = tickResourceProduction(state, MS_PER_HOUR * 10);
    const updatedMine = result.buildings[0]!;

    expect(updatedMine.uncollectedResources).toBe(GOLD_MINE_L1_CAP);
  });

  it('does not produce for buildings that are upgrading', () => {
    const startAmount = 50;
    const mine = makeCollector('Gold Mine', {
      uncollectedResources: startAmount,
      isUpgrading: true,
      upgradeTimeRemaining: 300,
      assignedBuilder: 1,
    });
    const state = makeState({ buildings: [mine] });

    const result = tickResourceProduction(state, MS_PER_HOUR);
    const updatedMine = result.buildings[0]!;

    // Should remain at the starting amount, not accumulate further
    expect(updatedMine.uncollectedResources).toBe(startAmount);
  });

  it('scales production by gameClockSpeed', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 0 });
    const state = makeState({ buildings: [mine], gameClockSpeed: 10 });

    const result = tickResourceProduction(state, MS_PER_HOUR);
    const updatedMine = result.buildings[0]!;

    // 200 per hour * 10x speed = 2000, but capped at 1000
    expect(updatedMine.uncollectedResources).toBe(GOLD_MINE_L1_CAP);
  });

  it('handles multiple collectors simultaneously', () => {
    const goldMine = makeCollector('Gold Mine', {
      instanceId: 'gold_1',
      uncollectedResources: 0,
    });
    const elixirCollector = makeCollector('Elixir Collector', {
      instanceId: 'elixir_1',
      uncollectedResources: 0,
    });
    const state = makeState({ buildings: [goldMine, elixirCollector] });

    const result = tickResourceProduction(state, MS_PER_HOUR);

    expect(result.buildings[0]!.uncollectedResources).toBeCloseTo(GOLD_MINE_L1_RATE, 5);
    expect(result.buildings[1]!.uncollectedResources).toBeCloseTo(200, 5);
  });

  it('starts from existing uncollectedResources', () => {
    const existing = 500;
    const mine = makeCollector('Gold Mine', { uncollectedResources: existing });
    const state = makeState({ buildings: [mine] });

    // 1 hour produces 200, starting from 500 = 700 total
    const result = tickResourceProduction(state, MS_PER_HOUR);
    const updatedMine = result.buildings[0]!;

    expect(updatedMine.uncollectedResources).toBeCloseTo(existing + GOLD_MINE_L1_RATE, 5);
  });
});

// ---------------------------------------------------------------------------
// getStorageCapacity
// ---------------------------------------------------------------------------
describe('getStorageCapacity', () => {
  it('returns TH bonus when no storage buildings exist', () => {
    const state = makeState();
    const caps = getStorageCapacity(state);

    expect(caps.gold).toBe(TH1_GOLD_CAP);
    expect(caps.elixir).toBe(TH1_ELIXIR_CAP);
    expect(caps.darkElixir).toBe(0);
  });

  it('adds storage building capacity to TH bonus', () => {
    const goldStorage = makeStorage('Gold Storage');
    const state = makeState({ buildings: [goldStorage] });
    const caps = getStorageCapacity(state);

    // Gold Storage L1 (1500) + TH1 bonus (1000) = 2500
    expect(caps.gold).toBe(GOLD_STORAGE_L1_CAP + TH1_GOLD_CAP);
  });

  it('handles multiple storages for the same resource', () => {
    const gs1 = makeStorage('Gold Storage', { instanceId: 'gs_1' });
    const gs2 = makeStorage('Gold Storage', { instanceId: 'gs_2' });
    const state = makeState({ buildings: [gs1, gs2] });
    const caps = getStorageCapacity(state);

    // Two Gold Storages L1 (1500 each) + TH1 bonus (1000) = 4000
    expect(caps.gold).toBe(GOLD_STORAGE_L1_CAP * 2 + TH1_GOLD_CAP);
  });

  it('sets gems cap to Infinity', () => {
    const state = makeState();
    const caps = getStorageCapacity(state);

    expect(caps.gems).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// collectFromBuilding
// ---------------------------------------------------------------------------
describe('collectFromBuilding', () => {
  it('collects gold from a Gold Mine into village resources', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 150 });
    const state = makeState({ buildings: [mine] });

    const result = collectFromBuilding(state, 'test_Gold Mine');

    expect(result.resources.gold).toBe(150);
  });

  it('caps collection at storage capacity', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 800 });
    // TH1 gold cap is 1000, current gold is 500, so only 500 more can fit
    const state = makeState({
      buildings: [mine],
      resources: { gold: 500, elixir: 0, darkElixir: 0, gems: 0 },
    });

    const result = collectFromBuilding(state, 'test_Gold Mine');

    // max cap for TH1 is 1000, current is 500, so can add at most 500 of the 800
    expect(result.resources.gold).toBe(TH1_GOLD_CAP);
  });

  it('resets uncollectedResources to 0 after collection', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 200 });
    const state = makeState({ buildings: [mine] });

    const result = collectFromBuilding(state, 'test_Gold Mine');
    const updatedMine = result.buildings.find((b) => b.instanceId === 'test_Gold Mine');

    expect(updatedMine?.uncollectedResources).toBe(0);
  });

  it('returns state unchanged if building has no uncollected resources', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 0 });
    const state = makeState({ buildings: [mine] });

    const result = collectFromBuilding(state, 'test_Gold Mine');

    expect(result).toBe(state);
  });

  it('returns state unchanged for a non-existent instanceId', () => {
    const mine = makeCollector('Gold Mine', { uncollectedResources: 100 });
    const state = makeState({ buildings: [mine] });

    const result = collectFromBuilding(state, 'does_not_exist');

    expect(result).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// collectAllResources
// ---------------------------------------------------------------------------
describe('collectAllResources', () => {
  it('collects from all collectors at once', () => {
    const goldMine = makeCollector('Gold Mine', {
      instanceId: 'gm_1',
      uncollectedResources: 100,
    });
    const elixirCollector = makeCollector('Elixir Collector', {
      instanceId: 'ec_1',
      uncollectedResources: 150,
    });
    const state = makeState({ buildings: [goldMine, elixirCollector] });

    const result = collectAllResources(state);

    expect(result.resources.gold).toBe(100);
    expect(result.resources.elixir).toBe(150);

    const updatedGm = result.buildings.find((b) => b.instanceId === 'gm_1');
    const updatedEc = result.buildings.find((b) => b.instanceId === 'ec_1');
    expect(updatedGm?.uncollectedResources).toBe(0);
    expect(updatedEc?.uncollectedResources).toBe(0);
  });

  it('caps total collected at storage limit', () => {
    // TH1 gold cap = 1000. Two gold mines with 800 each = 1600 total,
    // but only 1000 can be stored.
    const gm1 = makeCollector('Gold Mine', {
      instanceId: 'gm_1',
      uncollectedResources: 800,
    });
    const gm2 = makeCollector('Gold Mine', {
      instanceId: 'gm_2',
      uncollectedResources: 800,
    });
    const state = makeState({ buildings: [gm1, gm2] });

    const result = collectAllResources(state);

    expect(result.resources.gold).toBe(TH1_GOLD_CAP);
  });
});
