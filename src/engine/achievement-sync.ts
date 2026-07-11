// Bridges gameplay statistics to the achievement tracker. Every achievement's
// running value is derived from the persisted GameStatistics, the trophy count,
// and campaign stars, so progress survives reloads and is never double-counted.
// Pure: no timers, no globals, no mutation.

import type { VillageState } from '../types/village.ts';
import type { GameStatistics } from './statistics-tracker.ts';
import { createStatistics } from './statistics-tracker.ts';
import type { AchievementProgress } from './achievement-manager.ts';
import { updateAchievementProgress } from './achievement-manager.ts';

export interface AchievementInputs {
  statistics: GameStatistics;
  trophies: number;
  campaignStars: number;
}

// Maps each achievement id (see ACHIEVEMENTS in achievement-manager) to the
// metric that drives its progress. Lookup table keeps the sync branch-free.
const ACHIEVEMENT_METRICS: Array<{ id: string; value: (i: AchievementInputs) => number }> = [
  { id: 'sweet_victory', value: (i) => Math.max(0, i.trophies) },
  { id: 'conqueror', value: (i) => i.statistics.totalStarsEarned },
  { id: 'unbreakable', value: (i) => i.statistics.totalDefenses },
  { id: 'empire_builder', value: (i) => i.statistics.buildingsUpgraded },
  { id: 'gold_grab', value: (i) => i.statistics.totalGoldLooted },
  { id: 'elixir_escapade', value: (i) => i.statistics.totalElixirLooted },
  { id: 'heroic', value: (i) => i.statistics.totalDarkElixirLooted },
  { id: 'get_those_goblins', value: (i) => i.campaignStars },
];

/**
 * Advance every tracked achievement to match the current inputs. Progress only
 * moves forward (updateAchievementProgress never decrements) and claimedTier is
 * preserved, so calling this repeatedly is safe and idempotent for fixed inputs.
 */
export function syncAchievements(
  progress: AchievementProgress[],
  inputs: AchievementInputs,
): AchievementProgress[] {
  let next = progress;
  for (const metric of ACHIEVEMENT_METRICS) {
    next = updateAchievementProgress(next, metric.id, metric.value(inputs));
  }
  return next;
}

/** Total campaign stars earned so far (0 when the campaign is untouched). */
export function getCampaignStars(village: VillageState): number {
  return village.campaignProgress?.totalStars ?? 0;
}

/**
 * Return a village whose `achievements` array reflects its current statistics,
 * trophies, and campaign stars. Fills in a fresh statistics object for older
 * saves. The village's `statistics` is passed through unchanged.
 */
export function withAchievementSync(village: VillageState): VillageState {
  const statistics = village.statistics ?? createStatistics();
  const achievements = syncAchievements(village.achievements ?? [], {
    statistics,
    trophies: village.trophies,
    campaignStars: getCampaignStars(village),
  });
  return { ...village, statistics, achievements };
}
