import type { VillageState } from '../../types/village.ts';
import {
  TREASURY_STEAL_FRACTION,
  createTreasury,
  getTreasury,
  getTreasuryCapacity,
  addToTreasury,
  collectTreasury,
  calculateTreasurySteal,
  applyTreasurySteal,
} from '../treasury-manager.ts';
import { calculateTotalLoot } from '../loot-calculator.ts';
import { getStorageCapacity } from '../resource-manager.ts';

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
    lastSaveTimestamp: 0,
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------
describe('createTreasury / getTreasury', () => {
  it('creates an empty treasury', () => {
    expect(createTreasury()).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });

  it('returns an empty treasury when the village has none', () => {
    expect(getTreasury(makeVillage())).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });

  it('returns the stored treasury when present', () => {
    const state = makeVillage({ treasury: { gold: 100, elixir: 200, darkElixir: 5 } });
    expect(getTreasury(state)).toEqual({ gold: 100, elixir: 200, darkElixir: 5 });
  });
});

describe('getTreasuryCapacity', () => {
  it('scales with Town Hall level', () => {
    const low = getTreasuryCapacity(3);
    const high = getTreasuryCapacity(12);
    expect(high.gold).toBeGreaterThan(low.gold);
    expect(high.darkElixir).toBeGreaterThan(low.darkElixir);
  });

  it('holds no dark elixir before TH6', () => {
    expect(getTreasuryCapacity(5).darkElixir).toBe(0);
  });

  it('falls back to the top tier for out-of-range levels', () => {
    expect(getTreasuryCapacity(99)).toEqual(getTreasuryCapacity(17));
  });
});

// ---------------------------------------------------------------------------
// addToTreasury
// ---------------------------------------------------------------------------
describe('addToTreasury', () => {
  it('deposits loot into the treasury', () => {
    const state = addToTreasury(makeVillage(), { gold: 5000, elixir: 4000, darkElixir: 100 });
    expect(state.treasury).toEqual({ gold: 5000, elixir: 4000, darkElixir: 100 });
  });

  it('accumulates across multiple deposits', () => {
    let state = addToTreasury(makeVillage(), { gold: 1000, elixir: 1000, darkElixir: 10 });
    state = addToTreasury(state, { gold: 500, elixir: 250, darkElixir: 5 });
    expect(state.treasury).toEqual({ gold: 1500, elixir: 1250, darkElixir: 15 });
  });

  it('clamps deposits at treasury capacity', () => {
    const capacity = getTreasuryCapacity(10);
    const state = addToTreasury(makeVillage(), {
      gold: capacity.gold + 999999,
      elixir: 0,
      darkElixir: 0,
    });
    expect(state.treasury?.gold).toBe(capacity.gold);
  });

  it('ignores negative amounts', () => {
    const state = addToTreasury(makeVillage(), { gold: -500, elixir: 0, darkElixir: 0 });
    expect(state.treasury).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });

  it('does not mutate the original state', () => {
    const state = makeVillage();
    addToTreasury(state, { gold: 100, elixir: 0, darkElixir: 0 });
    expect(state.treasury).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// collectTreasury
// ---------------------------------------------------------------------------
describe('collectTreasury', () => {
  it('moves treasury contents into storages', () => {
    const state = makeVillage({
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
      treasury: { gold: 1000, elixir: 800, darkElixir: 50 },
    });
    const collected = collectTreasury(state);
    expect(collected.resources.gold).toBe(1000);
    expect(collected.resources.elixir).toBe(800);
    expect(collected.resources.darkElixir).toBe(50);
    expect(collected.treasury).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });

  it('leaves overflow in the treasury when storages are full', () => {
    const state = makeVillage({
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
      treasury: { gold: 10, elixir: 0, darkElixir: 0 },
    });
    const caps = getStorageCapacity(state);
    const full = { ...state, resources: { ...state.resources, gold: caps.gold } };
    const collected = collectTreasury(full);
    expect(collected.resources.gold).toBe(caps.gold);
    expect(collected.treasury?.gold).toBe(10);
  });

  it('returns the same state when there is nothing to move', () => {
    const state = makeVillage();
    expect(collectTreasury(state)).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Treasury steal (3%)
// ---------------------------------------------------------------------------
describe('calculateTreasurySteal', () => {
  it('uses the 3% rate from game data', () => {
    expect(TREASURY_STEAL_FRACTION).toBeCloseTo(0.03);
  });

  it('takes 3% of each resource, floored', () => {
    const stolen = calculateTreasurySteal({ gold: 10000, elixir: 5000, darkElixir: 133 });
    expect(stolen).toEqual({ gold: 300, elixir: 150, darkElixir: 3 });
  });

  it('returns zeros for an empty treasury', () => {
    expect(calculateTreasurySteal(createTreasury())).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });
});

describe('applyTreasurySteal', () => {
  it('removes the stolen share from the treasury', () => {
    const state = makeVillage({ treasury: { gold: 10000, elixir: 5000, darkElixir: 100 } });
    const raided = applyTreasurySteal(state);
    expect(raided.treasury).toEqual({ gold: 9700, elixir: 4850, darkElixir: 97 });
  });

  it('returns the same state when nothing is stealable', () => {
    const state = makeVillage();
    expect(applyTreasurySteal(state)).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Loot calculation integration
// ---------------------------------------------------------------------------
describe('calculateTotalLoot treasury integration', () => {
  it('adds the 3% treasury steal to attack loot', () => {
    const defender = makeVillage({
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
      treasury: { gold: 100000, elixir: 50000, darkElixir: 1000 },
    });
    const loot = calculateTotalLoot(defender, defender.townHallLevel);
    expect(loot.gold).toBe(3000);
    expect(loot.elixir).toBe(1500);
    expect(loot.darkElixir).toBe(30);
  });

  it('treasury steal is unaffected by the TH-difference penalty', () => {
    const defender = makeVillage({
      townHallLevel: 5,
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
      treasury: { gold: 100000, elixir: 0, darkElixir: 0 },
    });
    // Attacker 4 TH levels above: storage loot multiplier drops to 5%,
    // but the treasury share stays at the flat 3%
    const loot = calculateTotalLoot(defender, 9);
    expect(loot.gold).toBe(3000);
  });

  it('changes nothing for defenders without a treasury', () => {
    const defender = makeVillage({
      resources: { gold: 10000, elixir: 0, darkElixir: 0, gems: 0 },
    });
    const loot = calculateTotalLoot(defender, defender.townHallLevel);
    expect(loot.gold).toBe(1000); // 10% storage rate at TH10 only
  });
});
