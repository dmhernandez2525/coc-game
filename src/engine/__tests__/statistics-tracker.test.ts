import {
  createStatistics,
  incrementStat,
  recordBattleStats,
  getStatLabel,
} from '../statistics-tracker.ts';
import type { GameStatistics } from '../statistics-tracker.ts';

// ---------------------------------------------------------------------------
// createStatistics
// ---------------------------------------------------------------------------

describe('createStatistics', () => {
  it('returns an object with all eleven stat keys', () => {
    const stats = createStatistics();
    const keys = Object.keys(stats);
    expect(keys).toHaveLength(11);
  });

  it('initialises every numeric field to zero', () => {
    const stats = createStatistics();
    for (const value of Object.values(stats)) {
      expect(value).toBe(0);
    }
  });

  it('returns a new object on each call (no shared reference)', () => {
    const a = createStatistics();
    const b = createStatistics();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('includes all expected keys matching the GameStatistics interface', () => {
    const stats = createStatistics();
    const expectedKeys: (keyof GameStatistics)[] = [
      'totalAttacks',
      'totalDefenses',
      'totalStarsEarned',
      'totalGoldLooted',
      'totalElixirLooted',
      'totalDarkElixirLooted',
      'highestTrophies',
      'buildingsUpgraded',
      'troopsTrained',
      'spellsUsed',
      'obstaclesRemoved',
    ];
    for (const key of expectedKeys) {
      expect(stats).toHaveProperty(key, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// incrementStat
// ---------------------------------------------------------------------------

describe('incrementStat', () => {
  it('increments the specified key by 1 when no amount is given', () => {
    const stats = createStatistics();
    const updated = incrementStat(stats, 'totalAttacks');
    expect(updated.totalAttacks).toBe(1);
  });

  it('increments the specified key by a custom amount', () => {
    const stats = createStatistics();
    const updated = incrementStat(stats, 'totalGoldLooted', 500);
    expect(updated.totalGoldLooted).toBe(500);
  });

  it('does not mutate the original statistics object', () => {
    const stats = createStatistics();
    const updated = incrementStat(stats, 'troopsTrained', 10);
    expect(stats.troopsTrained).toBe(0);
    expect(updated.troopsTrained).toBe(10);
    expect(updated).not.toBe(stats);
  });

  it('leaves all other fields unchanged', () => {
    const stats = createStatistics();
    const updated = incrementStat(stats, 'spellsUsed', 3);
    expect(updated.spellsUsed).toBe(3);

    const otherKeys: (keyof GameStatistics)[] = [
      'totalAttacks',
      'totalDefenses',
      'totalStarsEarned',
      'totalGoldLooted',
      'totalElixirLooted',
      'totalDarkElixirLooted',
      'highestTrophies',
      'buildingsUpgraded',
      'troopsTrained',
      'obstaclesRemoved',
    ];
    for (const key of otherKeys) {
      expect(updated[key]).toBe(0);
    }
  });

  it('stacks correctly across multiple sequential increments', () => {
    let stats = createStatistics();
    stats = incrementStat(stats, 'buildingsUpgraded', 2);
    stats = incrementStat(stats, 'buildingsUpgraded', 3);
    stats = incrementStat(stats, 'buildingsUpgraded');
    expect(stats.buildingsUpgraded).toBe(6);
  });

  it('handles very large amounts without loss of precision', () => {
    const stats = createStatistics();
    const updated = incrementStat(stats, 'totalGoldLooted', 1_000_000_000);
    expect(updated.totalGoldLooted).toBe(1_000_000_000);
  });

  it('works correctly for every stat key', () => {
    const allKeys: (keyof GameStatistics)[] = [
      'totalAttacks',
      'totalDefenses',
      'totalStarsEarned',
      'totalGoldLooted',
      'totalElixirLooted',
      'totalDarkElixirLooted',
      'highestTrophies',
      'buildingsUpgraded',
      'troopsTrained',
      'spellsUsed',
      'obstaclesRemoved',
    ];

    for (const key of allKeys) {
      const stats = createStatistics();
      const updated = incrementStat(stats, key, 7);
      expect(updated[key]).toBe(7);
    }
  });

  it('handles an amount of zero (no-op increment)', () => {
    const stats = createStatistics();
    const updated = incrementStat(stats, 'totalDefenses', 0);
    expect(updated.totalDefenses).toBe(0);
    // Still a new object even if the value is the same
    expect(updated).not.toBe(stats);
  });
});

// ---------------------------------------------------------------------------
// recordBattleStats
// ---------------------------------------------------------------------------

describe('recordBattleStats', () => {
  const baseBattleResult = {
    stars: 2,
    loot: { gold: 1000, elixir: 800, darkElixir: 50 },
    trophyChange: 25,
  };

  it('increments totalAttacks by 1', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, baseBattleResult);
    expect(updated.totalAttacks).toBe(1);
  });

  it('adds stars to totalStarsEarned', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, baseBattleResult);
    expect(updated.totalStarsEarned).toBe(2);
  });

  it('adds gold to totalGoldLooted', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, baseBattleResult);
    expect(updated.totalGoldLooted).toBe(1000);
  });

  it('adds elixir to totalElixirLooted', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, baseBattleResult);
    expect(updated.totalElixirLooted).toBe(800);
  });

  it('adds dark elixir to totalDarkElixirLooted', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, baseBattleResult);
    expect(updated.totalDarkElixirLooted).toBe(50);
  });

  it('updates highestTrophies when new total exceeds current record', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, baseBattleResult);
    expect(updated.highestTrophies).toBe(25);
  });

  it('does not lower highestTrophies on a negative trophyChange', () => {
    let stats = createStatistics();
    // First battle sets trophies to 100
    stats = recordBattleStats(stats, {
      stars: 3,
      loot: { gold: 0, elixir: 0, darkElixir: 0 },
      trophyChange: 100,
    });
    expect(stats.highestTrophies).toBe(100);

    // Second battle with a loss: trophies drop by 30, new total = 70
    // highestTrophies should remain at 100
    stats = recordBattleStats(stats, {
      stars: 0,
      loot: { gold: 0, elixir: 0, darkElixir: 0 },
      trophyChange: -30,
    });
    expect(stats.highestTrophies).toBe(100);
  });

  it('does not mutate the original statistics object', () => {
    const original = createStatistics();
    const updated = recordBattleStats(original, baseBattleResult);
    expect(original.totalAttacks).toBe(0);
    expect(original.totalStarsEarned).toBe(0);
    expect(original.totalGoldLooted).toBe(0);
    expect(updated).not.toBe(original);
  });

  it('accumulates correctly over multiple battles', () => {
    let stats = createStatistics();

    stats = recordBattleStats(stats, {
      stars: 1,
      loot: { gold: 200, elixir: 100, darkElixir: 10 },
      trophyChange: 15,
    });
    stats = recordBattleStats(stats, {
      stars: 3,
      loot: { gold: 500, elixir: 400, darkElixir: 20 },
      trophyChange: 30,
    });
    stats = recordBattleStats(stats, {
      stars: 2,
      loot: { gold: 300, elixir: 250, darkElixir: 5 },
      trophyChange: -10,
    });

    expect(stats.totalAttacks).toBe(3);
    expect(stats.totalStarsEarned).toBe(6);
    expect(stats.totalGoldLooted).toBe(1000);
    expect(stats.totalElixirLooted).toBe(750);
    expect(stats.totalDarkElixirLooted).toBe(35);
    // Trophy progression: 0 -> 15 -> 45 -> 35
    // Highest was 45
    expect(stats.highestTrophies).toBe(45);
  });

  it('handles a battle with zero loot and zero stars', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, {
      stars: 0,
      loot: { gold: 0, elixir: 0, darkElixir: 0 },
      trophyChange: 0,
    });
    expect(updated.totalAttacks).toBe(1);
    expect(updated.totalStarsEarned).toBe(0);
    expect(updated.totalGoldLooted).toBe(0);
    expect(updated.totalElixirLooted).toBe(0);
    expect(updated.totalDarkElixirLooted).toBe(0);
    expect(updated.highestTrophies).toBe(0);
  });

  it('does not alter fields unrelated to battle (e.g. buildingsUpgraded)', () => {
    let stats = createStatistics();
    stats = incrementStat(stats, 'buildingsUpgraded', 5);
    stats = incrementStat(stats, 'troopsTrained', 20);
    stats = incrementStat(stats, 'spellsUsed', 3);
    stats = incrementStat(stats, 'obstaclesRemoved', 7);
    stats = incrementStat(stats, 'totalDefenses', 2);

    const updated = recordBattleStats(stats, baseBattleResult);

    expect(updated.buildingsUpgraded).toBe(5);
    expect(updated.troopsTrained).toBe(20);
    expect(updated.spellsUsed).toBe(3);
    expect(updated.obstaclesRemoved).toBe(7);
    expect(updated.totalDefenses).toBe(2);
  });

  it('handles a large negative trophyChange from zero without going below zero for highestTrophies', () => {
    const stats = createStatistics();
    const updated = recordBattleStats(stats, {
      stars: 0,
      loot: { gold: 0, elixir: 0, darkElixir: 0 },
      trophyChange: -50,
    });
    // newTrophies = 0 + (-50) = -50, Math.max(0, -50) = 0
    expect(updated.highestTrophies).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getStatLabel
// ---------------------------------------------------------------------------

describe('getStatLabel', () => {
  it('returns "Total Attacks" for totalAttacks', () => {
    expect(getStatLabel('totalAttacks')).toBe('Total Attacks');
  });

  it('returns "Total Defenses" for totalDefenses', () => {
    expect(getStatLabel('totalDefenses')).toBe('Total Defenses');
  });

  it('returns "Stars Earned" for totalStarsEarned', () => {
    expect(getStatLabel('totalStarsEarned')).toBe('Stars Earned');
  });

  it('returns "Gold Looted" for totalGoldLooted', () => {
    expect(getStatLabel('totalGoldLooted')).toBe('Gold Looted');
  });

  it('returns "Elixir Looted" for totalElixirLooted', () => {
    expect(getStatLabel('totalElixirLooted')).toBe('Elixir Looted');
  });

  it('returns "Dark Elixir Looted" for totalDarkElixirLooted', () => {
    expect(getStatLabel('totalDarkElixirLooted')).toBe('Dark Elixir Looted');
  });

  it('returns "Highest Trophies" for highestTrophies', () => {
    expect(getStatLabel('highestTrophies')).toBe('Highest Trophies');
  });

  it('returns "Buildings Upgraded" for buildingsUpgraded', () => {
    expect(getStatLabel('buildingsUpgraded')).toBe('Buildings Upgraded');
  });

  it('returns "Troops Trained" for troopsTrained', () => {
    expect(getStatLabel('troopsTrained')).toBe('Troops Trained');
  });

  it('returns "Spells Used" for spellsUsed', () => {
    expect(getStatLabel('spellsUsed')).toBe('Spells Used');
  });

  it('returns "Obstacles Removed" for obstaclesRemoved', () => {
    expect(getStatLabel('obstaclesRemoved')).toBe('Obstacles Removed');
  });
});
