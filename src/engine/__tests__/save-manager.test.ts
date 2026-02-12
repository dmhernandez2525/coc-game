// @vitest-environment jsdom

import { createSaveManager } from '../save-manager';
import type { VillageState } from '../../types/village';

/**
 * Returns a minimal but complete VillageState. Any fields passed in
 * `overrides` are shallow-merged on top of the defaults.
 */
function makeVillageState(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 5,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 1000, elixir: 1000, darkElixir: 0, gems: 50 },
    builders: [
      { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
    ],
    army: [],
    spells: [],
    heroes: [],
    trophies: 200,
    league: 'Silver I',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: Date.now(),
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Save / Load round-trip tests
// ---------------------------------------------------------------------------

describe('save and load round-trip', () => {
  it('saves a VillageState and loads it back as a deep-equal copy', () => {
    const manager = createSaveManager();
    const state = makeVillageState();

    manager.save(state, 'slot1');
    const loaded = manager.load('slot1');

    expect(loaded).toEqual(state);
  });

  it('saves to multiple slots and loads each independently', () => {
    const manager = createSaveManager();
    const stateA = makeVillageState({ townHallLevel: 3, trophies: 100 });
    const stateB = makeVillageState({ townHallLevel: 8, trophies: 900 });

    manager.save(stateA, 'slotA');
    manager.save(stateB, 'slotB');

    expect(manager.load('slotA')).toEqual(stateA);
    expect(manager.load('slotB')).toEqual(stateB);
  });

  it('overwrites a slot when saving to the same id again', () => {
    const manager = createSaveManager();
    const original = makeVillageState({ townHallLevel: 2 });
    const updated = makeVillageState({ townHallLevel: 7 });

    manager.save(original, 'slot1');
    manager.save(updated, 'slot1');

    const loaded = manager.load('slot1');
    expect(loaded).toEqual(updated);
    expect(loaded?.townHallLevel).toBe(7);
  });

  it('uses the default slot id when none is provided', () => {
    const manager = createSaveManager();
    const state = makeVillageState();

    manager.save(state);
    const loaded = manager.load('slot1');

    expect(loaded).toEqual(state);
  });

  it('returns true from save on success', () => {
    const manager = createSaveManager();
    const state = makeVillageState();

    expect(manager.save(state, 'slot1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Slot management tests
// ---------------------------------------------------------------------------

describe('slot management', () => {
  it('listSlots returns metadata for all saved slots', () => {
    const manager = createSaveManager();
    manager.save(makeVillageState({ townHallLevel: 3 }), 'a');
    manager.save(makeVillageState({ townHallLevel: 6 }), 'b');

    const slots = manager.listSlots();

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ id: 'a', townHallLevel: 3 });
    expect(slots[1]).toMatchObject({ id: 'b', townHallLevel: 6 });

    // Each slot should carry a numeric timestamp
    for (const slot of slots) {
      expect(typeof slot.timestamp).toBe('number');
    }
  });

  it('listSlots returns an empty array when no saves exist', () => {
    const manager = createSaveManager();

    expect(manager.listSlots()).toEqual([]);
  });

  it('listSlots updates the entry when a slot is overwritten', () => {
    const manager = createSaveManager();
    manager.save(makeVillageState({ townHallLevel: 2 }), 'x');
    manager.save(makeVillageState({ townHallLevel: 9 }), 'x');

    const slots = manager.listSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0]?.townHallLevel).toBe(9);
  });

  it('delete removes the slot data and index entry', () => {
    const manager = createSaveManager();
    manager.save(makeVillageState(), 'toDelete');

    const result = manager.delete('toDelete');

    expect(result).toBe(true);
    expect(manager.load('toDelete')).toBeNull();
    expect(manager.listSlots()).toEqual([]);
  });

  it('delete returns false for a non-existent slot', () => {
    const manager = createSaveManager();

    expect(manager.delete('ghost')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Corruption handling tests
// ---------------------------------------------------------------------------

describe('corruption handling', () => {
  it('load returns null when localStorage contains invalid JSON', () => {
    localStorage.setItem('coc_save_corrupt', '{not valid json!!!');
    const manager = createSaveManager();

    expect(manager.load('corrupt')).toBeNull();
  });

  it('load returns null when data is valid JSON but missing required fields', () => {
    // Valid JSON but only has "townHallLevel"; missing version, buildings, etc.
    localStorage.setItem(
      'coc_save_partial',
      JSON.stringify({ townHallLevel: 1 }),
    );
    const manager = createSaveManager();

    expect(manager.load('partial')).toBeNull();
  });

  it('load returns null for a slot that was never saved', () => {
    const manager = createSaveManager();

    expect(manager.load('nonexistent')).toBeNull();
  });

  it('isValidSave rejects null', () => {
    const manager = createSaveManager();
    expect(manager.isValidSave(null)).toBe(false);
  });

  it('isValidSave rejects non-objects (string, number, boolean)', () => {
    const manager = createSaveManager();
    expect(manager.isValidSave('hello')).toBe(false);
    expect(manager.isValidSave(42)).toBe(false);
    expect(manager.isValidSave(true)).toBe(false);
  });

  it('isValidSave rejects an object missing required keys', () => {
    const manager = createSaveManager();
    // Has some keys, but not all of version, townHallLevel, buildings, resources, builders
    expect(manager.isValidSave({ version: 1, townHallLevel: 1 })).toBe(false);
  });

  it('isValidSave accepts a minimal valid state with all required keys', () => {
    const manager = createSaveManager();
    const minimal = {
      version: 1,
      townHallLevel: 1,
      buildings: [],
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
      builders: [],
    };

    expect(manager.isValidSave(minimal)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Auto-save tests
// ---------------------------------------------------------------------------

describe('auto-save', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enableAutoSave calls save at the configured interval', () => {
    const manager = createSaveManager();
    const state = makeVillageState({ townHallLevel: 4 });
    const getState = vi.fn(() => state);

    manager.enableAutoSave(getState, 5000);

    // No save yet before the interval fires
    expect(manager.load('autosave')).toBeNull();

    vi.advanceTimersByTime(5000);
    expect(getState).toHaveBeenCalledTimes(1);
    expect(manager.load('autosave')).toEqual(state);

    vi.advanceTimersByTime(5000);
    expect(getState).toHaveBeenCalledTimes(2);
  });

  it('disableAutoSave stops the interval', () => {
    const manager = createSaveManager();
    const getState = vi.fn(() => makeVillageState());

    manager.enableAutoSave(getState, 3000);
    vi.advanceTimersByTime(3000);
    expect(getState).toHaveBeenCalledTimes(1);

    manager.disableAutoSave();

    vi.advanceTimersByTime(9000);
    // Should still be 1, the interval was cleared
    expect(getState).toHaveBeenCalledTimes(1);
  });

  it('re-enabling auto-save replaces the previous interval', () => {
    const manager = createSaveManager();

    const stateA = makeVillageState({ townHallLevel: 2 });
    const stateB = makeVillageState({ townHallLevel: 10 });

    const getStateA = vi.fn(() => stateA);
    const getStateB = vi.fn(() => stateB);

    manager.enableAutoSave(getStateA, 5000);
    // Replace before the first interval fires
    manager.enableAutoSave(getStateB, 5000);

    vi.advanceTimersByTime(5000);

    // The first getter should never have been called because the interval was replaced
    expect(getStateA).not.toHaveBeenCalled();
    expect(getStateB).toHaveBeenCalledTimes(1);

    const loaded = manager.load('autosave');
    expect(loaded?.townHallLevel).toBe(10);
  });

  it('uses the default 60-second interval when none is specified', () => {
    const manager = createSaveManager();
    const state = makeVillageState();
    const getState = vi.fn(() => state);

    manager.enableAutoSave(getState);

    // Should not fire at 59 seconds
    vi.advanceTimersByTime(59_000);
    expect(getState).not.toHaveBeenCalled();

    // Should fire at 60 seconds
    vi.advanceTimersByTime(1_000);
    expect(getState).toHaveBeenCalledTimes(1);
  });
});
