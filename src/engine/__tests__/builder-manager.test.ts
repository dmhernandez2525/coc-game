import type { VillageState } from '../../types/village.ts';
import {
  getAvailableBuilder,
  assignBuilder,
  freeBuilder,
  getBuilderCount,
  canUnlockBuilder,
  unlockBuilder,
  calculateGemSpeedup,
} from '../builder-manager.ts';

function makeState(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 5,
    buildings: [],
    walls: [],
    traps: [],
    resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 5000 },
    builders: [
      { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
      { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
      { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
    ],
    army: [],
    spells: [],
    heroes: [],
    trophies: 0,
    league: 'Unranked',
    campaignProgress: { levels: [], totalStars: 0 },
    lastSaveTimestamp: Date.now(),
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getAvailableBuilder
// ---------------------------------------------------------------------------
describe('getAvailableBuilder', () => {
  it('returns the first idle unlocked builder', () => {
    const state = makeState();
    const builder = getAvailableBuilder(state);

    expect(builder).toBeDefined();
    expect(builder?.id).toBe(1);
    expect(builder?.isUnlocked).toBe(true);
    expect(builder?.assignedTo).toBeNull();
  });

  it('skips busy builders and returns the next idle one', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'building-abc', timeRemaining: 300 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const builder = getAvailableBuilder(state);

    expect(builder).toBeDefined();
    expect(builder?.id).toBe(2);
  });

  it('returns undefined when all unlocked builders are busy', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'building-1', timeRemaining: 100 },
        { id: 2, isUnlocked: true, assignedTo: 'building-2', timeRemaining: 200 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const result = getAvailableBuilder(state);

    expect(result).toBeUndefined();
  });

  it('returns undefined when no builders are unlocked', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 2, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const result = getAvailableBuilder(state);

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// assignBuilder
// ---------------------------------------------------------------------------
describe('assignBuilder', () => {
  it('sets assignedTo and timeRemaining on the target builder', () => {
    const state = makeState();
    const updated = assignBuilder(state, 1, 'cannon-42', 600);

    const builder = updated.builders.find((b) => b.id === 1);
    expect(builder?.assignedTo).toBe('cannon-42');
    expect(builder?.timeRemaining).toBe(600);
  });

  it('does not mutate the original state', () => {
    const state = makeState();
    const original = state.builders.find((b) => b.id === 1);
    assignBuilder(state, 1, 'cannon-42', 600);

    expect(original?.assignedTo).toBeNull();
    expect(original?.timeRemaining).toBe(0);
  });

  it('does not affect other builders', () => {
    const state = makeState();
    const updated = assignBuilder(state, 1, 'cannon-42', 600);

    const otherBuilder = updated.builders.find((b) => b.id === 2);
    expect(otherBuilder?.assignedTo).toBeNull();
    expect(otherBuilder?.timeRemaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// freeBuilder
// ---------------------------------------------------------------------------
describe('freeBuilder', () => {
  it('clears assignedTo and timeRemaining for the specified builder', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'building-xyz', timeRemaining: 500 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const updated = freeBuilder(state, 1);

    const builder = updated.builders.find((b) => b.id === 1);
    expect(builder?.assignedTo).toBeNull();
    expect(builder?.timeRemaining).toBe(0);
  });

  it('does not mutate the original state', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'building-xyz', timeRemaining: 500 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const originalBuilder = state.builders.find((b) => b.id === 1);
    freeBuilder(state, 1);

    expect(originalBuilder?.assignedTo).toBe('building-xyz');
    expect(originalBuilder?.timeRemaining).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// getBuilderCount
// ---------------------------------------------------------------------------
describe('getBuilderCount', () => {
  it('returns correct idle and total with default state (2 unlocked, 0 busy)', () => {
    const state = makeState();
    const counts = getBuilderCount(state);

    expect(counts).toEqual({ idle: 2, total: 2 });
  });

  it('counts correctly with mixed busy and idle builders', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'building-a', timeRemaining: 100 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: true, assignedTo: 'building-b', timeRemaining: 200 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const counts = getBuilderCount(state);

    expect(counts).toEqual({ idle: 1, total: 3 });
  });

  it('returns 0 idle and 0 total when no builders are unlocked', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 2, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const counts = getBuilderCount(state);

    expect(counts).toEqual({ idle: 0, total: 0 });
  });

  it('returns all 5 when every builder is unlocked and idle', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const counts = getBuilderCount(state);

    expect(counts).toEqual({ idle: 5, total: 5 });
  });
});

// ---------------------------------------------------------------------------
// canUnlockBuilder
// ---------------------------------------------------------------------------
describe('canUnlockBuilder', () => {
  it('returns true when gems are sufficient for the next builder', () => {
    // 2 unlocked, next is builder 3 which costs 500 gems. We have 5000.
    const state = makeState();
    expect(canUnlockBuilder(state)).toBe(true);
  });

  it('returns false when gems are insufficient for the next builder', () => {
    // Builder 3 costs 500 gems; set gems to 499.
    const state = makeState({
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 499 },
    });
    expect(canUnlockBuilder(state)).toBe(false);
  });

  it('returns true when gems exactly match the cost', () => {
    // Builder 3 costs 500 gems; set gems to exactly 500.
    const state = makeState({
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 500 },
    });
    expect(canUnlockBuilder(state)).toBe(true);
  });

  it('returns false when all 5 builders are already unlocked', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
      ],
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 99999 },
    });
    expect(canUnlockBuilder(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// unlockBuilder
// ---------------------------------------------------------------------------
describe('unlockBuilder', () => {
  it('deducts gems and unlocks the next builder', () => {
    // 2 builders unlocked; next is builder 3 at 500 gems
    const state = makeState({
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 5000 },
    });
    const result = unlockBuilder(state);

    expect(result).not.toBeNull();
    expect(result!.resources.gems).toBe(4500); // 5000 - 500
    const builder3 = result!.builders.find((b) => b.id === 3);
    expect(builder3?.isUnlocked).toBe(true);
  });

  it('does not affect already-unlocked builders', () => {
    const state = makeState();
    const result = unlockBuilder(state);

    expect(result).not.toBeNull();
    const builder1 = result!.builders.find((b) => b.id === 1);
    const builder2 = result!.builders.find((b) => b.id === 2);
    expect(builder1?.isUnlocked).toBe(true);
    expect(builder2?.isUnlocked).toBe(true);
  });

  it('returns null when the player cannot afford the next builder', () => {
    const state = makeState({
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 100 },
    });
    const result = unlockBuilder(state);

    expect(result).toBeNull();
  });

  it('returns null when all 5 builders are already unlocked', () => {
    const state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
      ],
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 99999 },
    });
    const result = unlockBuilder(state);

    expect(result).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = makeState({
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 5000 },
    });
    unlockBuilder(state);

    expect(state.resources.gems).toBe(5000);
    const builder3 = state.builders.find((b) => b.id === 3);
    expect(builder3?.isUnlocked).toBe(false);
  });

  it('unlocks builders sequentially with correct costs', () => {
    // Start with 1 builder unlocked, then unlock 2 through 5 in sequence.
    // Builder 2 = 250, builder 3 = 500, builder 4 = 1000, builder 5 = 2000
    let state = makeState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 2, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
      resources: { gold: 10000, elixir: 10000, darkElixir: 0, gems: 3750 },
    });

    // Unlock builder 2: cost 250
    state = unlockBuilder(state)!;
    expect(state.resources.gems).toBe(3500);
    expect(state.builders.find((b) => b.id === 2)?.isUnlocked).toBe(true);

    // Unlock builder 3: cost 500
    state = unlockBuilder(state)!;
    expect(state.resources.gems).toBe(3000);
    expect(state.builders.find((b) => b.id === 3)?.isUnlocked).toBe(true);

    // Unlock builder 4: cost 1000
    state = unlockBuilder(state)!;
    expect(state.resources.gems).toBe(2000);
    expect(state.builders.find((b) => b.id === 4)?.isUnlocked).toBe(true);

    // Unlock builder 5: cost 2000
    state = unlockBuilder(state)!;
    expect(state.resources.gems).toBe(0);
    expect(state.builders.find((b) => b.id === 5)?.isUnlocked).toBe(true);

    // No more builders to unlock
    expect(unlockBuilder(state)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateGemSpeedup
// ---------------------------------------------------------------------------
describe('calculateGemSpeedup', () => {
  it('returns 0 for 0 remaining seconds', () => {
    expect(calculateGemSpeedup(0)).toBe(0);
  });

  it('returns 0 for negative remaining seconds', () => {
    expect(calculateGemSpeedup(-100)).toBe(0);
  });

  it('returns 1 gem for a very short timer (under 60s)', () => {
    // 30s out of 60s = 0.5 gems, rounded up to 1. Max(1, 1) = 1.
    expect(calculateGemSpeedup(30)).toBe(1);
    // 1 second: ceil(1/60 * 1) = ceil(0.0167) = 1, max(1, 1) = 1
    expect(calculateGemSpeedup(1)).toBe(1);
  });

  it('returns 1 gem at exactly the first breakpoint (60s)', () => {
    // 60/60 * 1 = 1 gem
    expect(calculateGemSpeedup(60)).toBe(1);
  });

  it('returns 20 gems at exactly 1 hour (3600s)', () => {
    expect(calculateGemSpeedup(3600)).toBe(20);
  });

  it('interpolates correctly between 1 minute and 1 hour', () => {
    // Midpoint: 1830 seconds (30.5 minutes)
    // lower = {60, 1}, upper = {3600, 20}
    // fraction = (1830 - 60) / (3600 - 60) = 1770 / 3540 = 0.5
    // cost = 1 + 0.5 * (20 - 1) = 1 + 9.5 = 10.5, ceil = 11
    expect(calculateGemSpeedup(1830)).toBe(11);
  });

  it('returns 260 gems at exactly 1 day (86400s)', () => {
    expect(calculateGemSpeedup(86400)).toBe(260);
  });

  it('interpolates correctly between 1 hour and 1 day', () => {
    // Halfway: (3600 + 86400) / 2 = 45000s
    // fraction = (45000 - 3600) / (86400 - 3600) = 41400 / 82800 = 0.5
    // cost = 20 + 0.5 * (260 - 20) = 20 + 120 = 140
    expect(calculateGemSpeedup(45000)).toBe(140);
  });

  it('returns 1000 gems at exactly 1 week (604800s)', () => {
    expect(calculateGemSpeedup(604800)).toBe(1000);
  });

  it('extrapolates beyond the last breakpoint (1 week)', () => {
    // Rate from 1 day to 1 week:
    // (1000 - 260) / (604800 - 86400) = 740 / 518400
    // At 2 weeks (1209600s), extra time = 1209600 - 604800 = 604800
    // cost = 1000 + (740/518400) * 604800 = 1000 + 863.07... = ceil(1863.07) = 1864
    const twoWeeks = 604800 * 2;
    const rate = 740 / 518400;
    const extraTime = twoWeeks - 604800;
    const expected = Math.ceil(1000 + rate * extraTime);
    expect(calculateGemSpeedup(twoWeeks)).toBe(expected);
  });

  it('scales up for very large timers (14 days)', () => {
    // For 14 days the result should be larger than the 1 week value of 1000
    const fourteenDays = 86400 * 14;
    const result = calculateGemSpeedup(fourteenDays);
    expect(result).toBeGreaterThan(1000);
  });
});
