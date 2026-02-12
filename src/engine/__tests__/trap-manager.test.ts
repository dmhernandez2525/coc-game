import type { PlacedTrap } from '../../types/village.ts';
import {
  getTrapData,
  getTrapStats,
  getMaxTrapCount,
  getCurrentTrapCount,
  placeTrap,
  upgradeTrap,
  rearmTrap,
  removeTrap,
  getAllAvailableTraps,
} from '../trap-manager.ts';

// All 8 trap names from traps.json for reference:
// Bomb (TH3), Spring Trap (TH4), Air Bomb (TH5), Giant Bomb (TH6),
// Seeking Air Mine (TH7), Skeleton Trap (TH8), Tornado Trap (TH11), Giga Bomb (TH17)

function makeTrap(overrides?: Partial<PlacedTrap>): PlacedTrap {
  return {
    instanceId: 'trap_test_0',
    trapId: 'Bomb',
    level: 1,
    gridX: 10,
    gridY: 10,
    isArmed: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getTrapData
// ---------------------------------------------------------------------------
describe('getTrapData', () => {
  it('returns data for a valid trap name (Bomb)', () => {
    const data = getTrapData('Bomb');
    expect(data).toBeDefined();
    expect(data!.name).toBe('Bomb');
    expect(data!.category).toBe('trap');
  });

  it('returns data for every known trap type', () => {
    const knownTraps = [
      'Bomb',
      'Spring Trap',
      'Air Bomb',
      'Giant Bomb',
      'Seeking Air Mine',
      'Skeleton Trap',
      'Tornado Trap',
      'Giga Bomb',
    ];
    for (const name of knownTraps) {
      const data = getTrapData(name);
      expect(data).toBeDefined();
      expect(data!.name).toBe(name);
    }
  });

  it('returns undefined for an unknown trap name', () => {
    expect(getTrapData('Nonexistent Trap')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(getTrapData('')).toBeUndefined();
  });

  it('is case-sensitive (lowercase fails)', () => {
    expect(getTrapData('bomb')).toBeUndefined();
  });

  it('includes expected fields on a returned TrapData', () => {
    const data = getTrapData('Giant Bomb');
    expect(data).toBeDefined();
    expect(data!.thUnlock).toBe(6);
    expect(data!.targetType).toBe('ground');
    expect(data!.tileSize).toBe('2x2');
    expect(data!.levels.length).toBeGreaterThan(0);
    expect(data!.maxCountByTH).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getTrapStats
// ---------------------------------------------------------------------------
describe('getTrapStats', () => {
  it('returns level 1 stats for Bomb', () => {
    const stats = getTrapStats('Bomb', 1);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.damage).toBe(20);
    expect(stats!.upgradeCost).toBe(400);
    expect(stats!.upgradeResource).toBe('Gold');
    expect(stats!.upgradeTime).toBe(0);
    expect(stats!.thRequired).toBe(3);
  });

  it('returns correct stats for a mid-level trap', () => {
    const stats = getTrapStats('Bomb', 7);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(7);
    expect(stats!.damage).toBe(72);
    expect(stats!.thRequired).toBe(10);
  });

  it('returns correct stats for the max level of a trap', () => {
    const stats = getTrapStats('Bomb', 14);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(14);
    expect(stats!.damage).toBe(200);
  });

  it('returns undefined for a level beyond max', () => {
    expect(getTrapStats('Bomb', 15)).toBeUndefined();
    expect(getTrapStats('Bomb', 999)).toBeUndefined();
  });

  it('returns undefined for level 0', () => {
    expect(getTrapStats('Bomb', 0)).toBeUndefined();
  });

  it('returns undefined for a negative level', () => {
    expect(getTrapStats('Bomb', -1)).toBeUndefined();
  });

  it('returns undefined for an unknown trap name', () => {
    expect(getTrapStats('Fake Trap', 1)).toBeUndefined();
  });

  it('returns stats for Spring Trap with capacity field', () => {
    const stats = getTrapStats('Spring Trap', 1);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.capacity).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// getMaxTrapCount
// ---------------------------------------------------------------------------
describe('getMaxTrapCount', () => {
  it('returns correct max for Bomb at TH3 (unlock level)', () => {
    expect(getMaxTrapCount('Bomb', 3)).toBe(2);
  });

  it('returns correct max for Bomb at TH7', () => {
    expect(getMaxTrapCount('Bomb', 7)).toBe(6);
  });

  it('returns correct max for Bomb at TH13', () => {
    expect(getMaxTrapCount('Bomb', 13)).toBe(7);
  });

  it('returns 0 for Bomb at TH2 (below unlock)', () => {
    // TH2 key does not exist in maxCountByTH
    expect(getMaxTrapCount('Bomb', 2)).toBe(0);
  });

  it('returns 0 for an unknown trap name', () => {
    expect(getMaxTrapCount('Imaginary Trap', 10)).toBe(0);
  });

  it('returns 0 for a TH level with no entry in maxCountByTH', () => {
    // Giga Bomb only has entries for TH17 and TH18
    expect(getMaxTrapCount('Giga Bomb', 16)).toBe(0);
  });

  it('returns 1 for Tornado Trap at any valid TH (always capped at 1)', () => {
    expect(getMaxTrapCount('Tornado Trap', 11)).toBe(1);
    expect(getMaxTrapCount('Tornado Trap', 15)).toBe(1);
    expect(getMaxTrapCount('Tornado Trap', 18)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getCurrentTrapCount
// ---------------------------------------------------------------------------
describe('getCurrentTrapCount', () => {
  it('returns 0 for an empty trap array', () => {
    expect(getCurrentTrapCount([], 'Bomb')).toBe(0);
  });

  it('counts matching traps correctly', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'a', trapId: 'Bomb' }),
      makeTrap({ instanceId: 'b', trapId: 'Bomb' }),
      makeTrap({ instanceId: 'c', trapId: 'Spring Trap' }),
    ];
    expect(getCurrentTrapCount(traps, 'Bomb')).toBe(2);
    expect(getCurrentTrapCount(traps, 'Spring Trap')).toBe(1);
  });

  it('returns 0 when no traps match the given ID', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'a', trapId: 'Air Bomb' }),
    ];
    expect(getCurrentTrapCount(traps, 'Bomb')).toBe(0);
  });

  it('returns 0 for an unknown trap ID even with traps present', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'a', trapId: 'Bomb' }),
    ];
    expect(getCurrentTrapCount(traps, 'Unknown')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// placeTrap
// ---------------------------------------------------------------------------
describe('placeTrap', () => {
  it('places a new Bomb at TH3 successfully', () => {
    const result = placeTrap([], 'Bomb', 5, 5, 3);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]!.trapId).toBe('Bomb');
    expect(result![0]!.level).toBe(1);
    expect(result![0]!.gridX).toBe(5);
    expect(result![0]!.gridY).toBe(5);
    expect(result![0]!.isArmed).toBe(true);
  });

  it('generates a unique instanceId containing "trap_"', () => {
    const result = placeTrap([], 'Bomb', 0, 0, 3);
    expect(result).not.toBeNull();
    expect(result![0]!.instanceId).toContain('trap_');
  });

  it('appends the new trap to the existing array', () => {
    const existing: PlacedTrap[] = [
      makeTrap({ instanceId: 'existing_1', trapId: 'Bomb' }),
    ];
    const result = placeTrap(existing, 'Spring Trap', 15, 15, 4);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0]!.instanceId).toBe('existing_1');
    expect(result![1]!.trapId).toBe('Spring Trap');
  });

  it('returns null for an unknown trap ID', () => {
    expect(placeTrap([], 'Fake Trap', 5, 5, 10)).toBeNull();
  });

  it('returns null when TH level is below the trap unlock level', () => {
    // Bomb unlocks at TH3; try at TH2
    expect(placeTrap([], 'Bomb', 5, 5, 2)).toBeNull();
  });

  it('returns null when TH level is below Giga Bomb unlock (TH17)', () => {
    expect(placeTrap([], 'Giga Bomb', 5, 5, 16)).toBeNull();
  });

  it('returns null when the max count for the trap type has been reached', () => {
    // Bomb at TH3 allows max 2
    const existing: PlacedTrap[] = [
      makeTrap({ instanceId: 'a', trapId: 'Bomb' }),
      makeTrap({ instanceId: 'b', trapId: 'Bomb' }),
    ];
    expect(placeTrap(existing, 'Bomb', 5, 5, 3)).toBeNull();
  });

  it('allows placing when count is below max', () => {
    // Bomb at TH3 allows 2; only 1 exists
    const existing: PlacedTrap[] = [
      makeTrap({ instanceId: 'a', trapId: 'Bomb' }),
    ];
    const result = placeTrap(existing, 'Bomb', 20, 20, 3);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });

  it('does not mutate the original array', () => {
    const existing: PlacedTrap[] = [
      makeTrap({ instanceId: 'a', trapId: 'Bomb' }),
    ];
    const originalLength = existing.length;
    placeTrap(existing, 'Bomb', 20, 20, 3);
    expect(existing).toHaveLength(originalLength);
  });

  it('new trap always starts at level 1', () => {
    const result = placeTrap([], 'Giant Bomb', 0, 0, 6);
    expect(result).not.toBeNull();
    expect(result![0]!.level).toBe(1);
  });

  it('new trap always starts armed', () => {
    const result = placeTrap([], 'Seeking Air Mine', 3, 3, 7);
    expect(result).not.toBeNull();
    expect(result![0]!.isArmed).toBe(true);
  });

  it('correctly enforces Tornado Trap max count of 1', () => {
    const existing: PlacedTrap[] = [
      makeTrap({ instanceId: 'tornado_1', trapId: 'Tornado Trap' }),
    ];
    // Tornado Trap maxCountByTH at any valid TH is always 1
    expect(placeTrap(existing, 'Tornado Trap', 5, 5, 11)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// upgradeTrap
// ---------------------------------------------------------------------------
describe('upgradeTrap', () => {
  it('upgrades a level 1 Bomb to level 2 at TH3', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', trapId: 'Bomb', level: 1 }),
    ];
    const result = upgradeTrap(traps, 'bomb_1', 3);
    expect(result).not.toBeNull();
    expect(result!.traps[0]!.level).toBe(2);
    expect(result!.cost).toBe(1000);
    expect(result!.time).toBe(360);
  });

  it('returns null when the instance ID is not found', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', trapId: 'Bomb', level: 1 }),
    ];
    expect(upgradeTrap(traps, 'nonexistent', 10)).toBeNull();
  });

  it('returns null when the trap is already at max level', () => {
    // Bomb max level is 14
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', trapId: 'Bomb', level: 14 }),
    ];
    expect(upgradeTrap(traps, 'bomb_1', 18)).toBeNull();
  });

  it('returns null when TH level is too low for the next level', () => {
    // Bomb level 3 requires TH5; try upgrading from level 2 at TH4
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', trapId: 'Bomb', level: 2 }),
    ];
    expect(upgradeTrap(traps, 'bomb_1', 4)).toBeNull();
  });

  it('succeeds when TH level exactly meets the requirement', () => {
    // Bomb level 3 requires TH5
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', trapId: 'Bomb', level: 2 }),
    ];
    const result = upgradeTrap(traps, 'bomb_1', 5);
    expect(result).not.toBeNull();
    expect(result!.traps[0]!.level).toBe(3);
    expect(result!.cost).toBe(10000);
  });

  it('does not mutate the original array', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', trapId: 'Bomb', level: 1 }),
    ];
    upgradeTrap(traps, 'bomb_1', 3);
    expect(traps[0]!.level).toBe(1);
  });

  it('does not affect other traps in the array', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', trapId: 'Bomb', level: 1 }),
      makeTrap({ instanceId: 'spring_1', trapId: 'Spring Trap', level: 3, gridX: 20 }),
    ];
    const result = upgradeTrap(traps, 'bomb_1', 3);
    expect(result).not.toBeNull();
    expect(result!.traps[1]!.trapId).toBe('Spring Trap');
    expect(result!.traps[1]!.level).toBe(3);
  });

  it('returns correct cost and time for a higher-level upgrade', () => {
    // Giant Bomb level 4 -> 5: cost 900000, time 36000, thRequired 11
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'gb_1', trapId: 'Giant Bomb', level: 4 }),
    ];
    const result = upgradeTrap(traps, 'gb_1', 11);
    expect(result).not.toBeNull();
    expect(result!.cost).toBe(900000);
    expect(result!.time).toBe(36000);
    expect(result!.traps[0]!.level).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// rearmTrap
// ---------------------------------------------------------------------------
describe('rearmTrap', () => {
  it('sets isArmed to true for a disarmed trap', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', isArmed: false }),
    ];
    const result = rearmTrap(traps, 'bomb_1');
    expect(result[0]!.isArmed).toBe(true);
  });

  it('keeps isArmed true for an already armed trap', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', isArmed: true }),
    ];
    const result = rearmTrap(traps, 'bomb_1');
    expect(result[0]!.isArmed).toBe(true);
  });

  it('does not mutate the original array', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', isArmed: false }),
    ];
    rearmTrap(traps, 'bomb_1');
    expect(traps[0]!.isArmed).toBe(false);
  });

  it('does not affect other traps in the array', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', isArmed: false }),
      makeTrap({ instanceId: 'spring_1', trapId: 'Spring Trap', isArmed: false }),
    ];
    const result = rearmTrap(traps, 'bomb_1');
    expect(result[0]!.isArmed).toBe(true);
    expect(result[1]!.isArmed).toBe(false);
  });

  it('returns a new array of the same length when instanceId not found', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1', isArmed: false }),
    ];
    const result = rearmTrap(traps, 'nonexistent');
    expect(result).toHaveLength(1);
    expect(result[0]!.isArmed).toBe(false);
  });

  it('returns an empty array when called on empty input', () => {
    const result = rearmTrap([], 'bomb_1');
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// removeTrap
// ---------------------------------------------------------------------------
describe('removeTrap', () => {
  it('removes the trap with the matching instanceId', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1' }),
      makeTrap({ instanceId: 'bomb_2', gridX: 20 }),
    ];
    const result = removeTrap(traps, 'bomb_1');
    expect(result).toHaveLength(1);
    expect(result[0]!.instanceId).toBe('bomb_2');
  });

  it('returns the full array when instanceId does not match', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1' }),
    ];
    const result = removeTrap(traps, 'nonexistent');
    expect(result).toHaveLength(1);
  });

  it('returns an empty array when removing the only trap', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1' }),
    ];
    const result = removeTrap(traps, 'bomb_1');
    expect(result).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const traps: PlacedTrap[] = [
      makeTrap({ instanceId: 'bomb_1' }),
      makeTrap({ instanceId: 'bomb_2', gridX: 20 }),
    ];
    removeTrap(traps, 'bomb_1');
    expect(traps).toHaveLength(2);
  });

  it('returns an empty array when called on empty input', () => {
    const result = removeTrap([], 'bomb_1');
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getAllAvailableTraps
// ---------------------------------------------------------------------------
describe('getAllAvailableTraps', () => {
  it('returns no traps at TH1 (nothing unlocked yet)', () => {
    const result = getAllAvailableTraps(1);
    expect(result).toHaveLength(0);
  });

  it('returns no traps at TH2 (still nothing unlocked)', () => {
    const result = getAllAvailableTraps(2);
    expect(result).toHaveLength(0);
  });

  it('returns 1 trap at TH3 (Bomb only)', () => {
    const result = getAllAvailableTraps(3);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Bomb');
  });

  it('returns 2 traps at TH4 (Bomb, Spring Trap)', () => {
    const result = getAllAvailableTraps(4);
    expect(result).toHaveLength(2);
    const names = result.map((t) => t.name);
    expect(names).toContain('Bomb');
    expect(names).toContain('Spring Trap');
  });

  it('returns 5 traps at TH7 (through Seeking Air Mine)', () => {
    const result = getAllAvailableTraps(7);
    expect(result).toHaveLength(5);
    const names = result.map((t) => t.name);
    expect(names).toContain('Bomb');
    expect(names).toContain('Spring Trap');
    expect(names).toContain('Air Bomb');
    expect(names).toContain('Giant Bomb');
    expect(names).toContain('Seeking Air Mine');
  });

  it('returns 7 traps at TH11 (adds Tornado Trap)', () => {
    const result = getAllAvailableTraps(11);
    expect(result).toHaveLength(7);
    const names = result.map((t) => t.name);
    expect(names).toContain('Tornado Trap');
    expect(names).not.toContain('Giga Bomb');
  });

  it('returns all 8 traps at TH17 (adds Giga Bomb)', () => {
    const result = getAllAvailableTraps(17);
    expect(result).toHaveLength(8);
    const names = result.map((t) => t.name);
    expect(names).toContain('Giga Bomb');
  });

  it('returns all 8 traps at TH18 (max TH, all available)', () => {
    const result = getAllAvailableTraps(18);
    expect(result).toHaveLength(8);
  });

  it('returns TrapData objects with correct structure', () => {
    const result = getAllAvailableTraps(10);
    for (const trap of result) {
      expect(trap.name).toBeDefined();
      expect(trap.category).toBe('trap');
      expect(trap.thUnlock).toBeLessThanOrEqual(10);
      expect(trap.levels.length).toBeGreaterThan(0);
      expect(trap.maxCountByTH).toBeDefined();
    }
  });
});
