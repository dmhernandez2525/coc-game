// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import type { VillageState } from '../../types/village';
import { useAutoSave, loadAutoSave } from '../useAutoSave';

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
    lastSaveTimestamp: 1000,
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Periodic saving
// ---------------------------------------------------------------------------

describe('useAutoSave periodic saving', () => {
  it('does not save immediately on mount', () => {
    const state = makeVillageState();
    renderHook(() => useAutoSave(state));

    expect(loadAutoSave()).toBeNull();
  });

  it('saves after the default 30-second interval', () => {
    const state = makeVillageState({ townHallLevel: 3 });
    renderHook(() => useAutoSave(state));

    vi.advanceTimersByTime(30_000);

    const loaded = loadAutoSave();
    expect(loaded).not.toBeNull();
    expect(loaded?.townHallLevel).toBe(3);
  });

  it('saves multiple times at repeated intervals', () => {
    const state = makeVillageState({ trophies: 500 });
    renderHook(() => useAutoSave(state));

    // After the first interval, the save should exist
    vi.advanceTimersByTime(30_000);
    expect(loadAutoSave()).toEqual(state);

    // Advance another 30 seconds; should still be a valid save
    vi.advanceTimersByTime(30_000);
    expect(loadAutoSave()).toEqual(state);
  });

  it('does not save before the interval elapses', () => {
    const state = makeVillageState();
    renderHook(() => useAutoSave(state));

    vi.advanceTimersByTime(29_999);
    expect(loadAutoSave()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Custom interval
// ---------------------------------------------------------------------------

describe('useAutoSave custom interval', () => {
  it('saves at the custom interval instead of 30 seconds', () => {
    const state = makeVillageState({ townHallLevel: 7 });
    renderHook(() => useAutoSave(state, 5_000));

    // Should not have saved at 4.9 seconds
    vi.advanceTimersByTime(4_999);
    expect(loadAutoSave()).toBeNull();

    // Should save at exactly 5 seconds
    vi.advanceTimersByTime(1);
    expect(loadAutoSave()?.townHallLevel).toBe(7);
  });

  it('resets the interval when intervalMs changes', () => {
    const state = makeVillageState({ trophies: 100 });

    const { rerender } = renderHook(
      ({ interval }) => useAutoSave(state, interval),
      { initialProps: { interval: 10_000 } },
    );

    // Advance 9 seconds with the original interval, no save yet
    vi.advanceTimersByTime(9_000);
    expect(loadAutoSave()).toBeNull();

    // Change to a 3-second interval; old timer should be cleared
    rerender({ interval: 3_000 });

    // After 3 seconds with the new interval, the save should fire
    vi.advanceTimersByTime(3_000);
    expect(loadAutoSave()).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// Unmount behavior
// ---------------------------------------------------------------------------

describe('useAutoSave unmount', () => {
  it('saves the current state when the component unmounts', () => {
    const state = makeVillageState({ townHallLevel: 9 });
    const { unmount } = renderHook(() => useAutoSave(state));

    // No periodic save has fired yet
    expect(loadAutoSave()).toBeNull();

    unmount();

    const loaded = loadAutoSave();
    expect(loaded).not.toBeNull();
    expect(loaded?.townHallLevel).toBe(9);
  });

  it('stops the periodic interval after unmount', () => {
    const state = makeVillageState();
    const { unmount } = renderHook(() => useAutoSave(state));

    unmount();
    // Clear the save that happened on unmount so we can detect new saves
    localStorage.clear();

    vi.advanceTimersByTime(60_000);
    expect(loadAutoSave()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ref freshness (avoids stale closure)
// ---------------------------------------------------------------------------

describe('useAutoSave uses latest state ref', () => {
  it('saves the most recent state, not the stale initial state', () => {
    const initial = makeVillageState({ townHallLevel: 1 });
    const updated = makeVillageState({ townHallLevel: 10 });

    const { rerender } = renderHook(
      ({ s }) => useAutoSave(s),
      { initialProps: { s: initial } },
    );

    // Update state before the first interval fires
    rerender({ s: updated });

    vi.advanceTimersByTime(30_000);

    const loaded = loadAutoSave();
    expect(loaded?.townHallLevel).toBe(10);
  });

  it('saves the latest state on unmount even after multiple updates', () => {
    const v1 = makeVillageState({ trophies: 0 });
    const v2 = makeVillageState({ trophies: 500 });
    const v3 = makeVillageState({ trophies: 1200 });

    const { rerender, unmount } = renderHook(
      ({ s }) => useAutoSave(s),
      { initialProps: { s: v1 } },
    );

    rerender({ s: v2 });
    rerender({ s: v3 });

    unmount();

    expect(loadAutoSave()?.trophies).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// loadAutoSave standalone behavior
// ---------------------------------------------------------------------------

describe('loadAutoSave', () => {
  it('returns null when no autosave exists in localStorage', () => {
    expect(loadAutoSave()).toBeNull();
  });

  it('returns the saved village state after a periodic save', () => {
    const state = makeVillageState({ league: 'Gold III' });
    renderHook(() => useAutoSave(state));

    vi.advanceTimersByTime(30_000);

    const loaded = loadAutoSave();
    expect(loaded).toEqual(state);
  });

  it('returns the last saved state after multiple saves', () => {
    const first = makeVillageState({ townHallLevel: 2 });
    const second = makeVillageState({ townHallLevel: 6 });

    const { rerender } = renderHook(
      ({ s }) => useAutoSave(s),
      { initialProps: { s: first } },
    );

    vi.advanceTimersByTime(30_000);
    expect(loadAutoSave()?.townHallLevel).toBe(2);

    rerender({ s: second });
    vi.advanceTimersByTime(30_000);
    expect(loadAutoSave()?.townHallLevel).toBe(6);
  });

  it('returns null when localStorage has corrupted data for the autosave slot', () => {
    localStorage.setItem('coc_save_autosave', 'not-valid-json{{{{');
    expect(loadAutoSave()).toBeNull();
  });
});
