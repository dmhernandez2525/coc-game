// Simple statistics tracking for the game.
// All functions are pure: they return new state, never mutate.

export interface GameStatistics {
  totalAttacks: number;
  totalDefenses: number;
  totalStarsEarned: number;
  totalGoldLooted: number;
  totalElixirLooted: number;
  totalDarkElixirLooted: number;
  highestTrophies: number;
  buildingsUpgraded: number;
  troopsTrained: number;
  spellsUsed: number;
  obstaclesRemoved: number;
}

/** Creates a fresh statistics object with all values at zero. */
export function createStatistics(): GameStatistics {
  return {
    totalAttacks: 0,
    totalDefenses: 0,
    totalStarsEarned: 0,
    totalGoldLooted: 0,
    totalElixirLooted: 0,
    totalDarkElixirLooted: 0,
    highestTrophies: 0,
    buildingsUpgraded: 0,
    troopsTrained: 0,
    spellsUsed: 0,
    obstaclesRemoved: 0,
  };
}

/** Increments a stat by the given amount (default 1). */
export function incrementStat(
  stats: GameStatistics,
  key: keyof GameStatistics,
  amount = 1,
): GameStatistics {
  return { ...stats, [key]: stats[key] + amount };
}

interface BattleResult {
  stars: number;
  loot: { gold: number; elixir: number; darkElixir: number };
  trophyChange: number;
}

/**
 * Records the outcome of an attack. Increments totalAttacks, totalStarsEarned,
 * looted resources, and updates highestTrophies when the new value exceeds
 * the current record. The caller should pass currentTrophies + trophyChange
 * via the trophyChange field, or simply pass the new trophy total.
 */
export function recordBattleStats(
  stats: GameStatistics,
  result: BattleResult,
): GameStatistics {
  const newTrophies = stats.highestTrophies + result.trophyChange;

  return {
    ...stats,
    totalAttacks: stats.totalAttacks + 1,
    totalStarsEarned: stats.totalStarsEarned + result.stars,
    totalGoldLooted: stats.totalGoldLooted + result.loot.gold,
    totalElixirLooted: stats.totalElixirLooted + result.loot.elixir,
    totalDarkElixirLooted: stats.totalDarkElixirLooted + result.loot.darkElixir,
    highestTrophies: Math.max(stats.highestTrophies, newTrophies),
  };
}

const statLabels: Record<keyof GameStatistics, string> = {
  totalAttacks: 'Total Attacks',
  totalDefenses: 'Total Defenses',
  totalStarsEarned: 'Stars Earned',
  totalGoldLooted: 'Gold Looted',
  totalElixirLooted: 'Elixir Looted',
  totalDarkElixirLooted: 'Dark Elixir Looted',
  highestTrophies: 'Highest Trophies',
  buildingsUpgraded: 'Buildings Upgraded',
  troopsTrained: 'Troops Trained',
  spellsUsed: 'Spells Used',
  obstaclesRemoved: 'Obstacles Removed',
};

/** Returns a human-readable label for the given stat key. */
export function getStatLabel(key: keyof GameStatistics): string {
  return statLabels[key];
}
