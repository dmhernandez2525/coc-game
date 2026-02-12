import type { CampaignProgress, CampaignLevelProgress } from '../types/village.ts';
import { campaignData } from '../data/loaders/economy-loader.ts';

export interface CampaignLevel {
  level: number;
  name: string;
  goldLoot: number;
  elixirLoot: number;
  darkElixirLoot: number;
  maxStars: number;
}

interface StarRewardTier {
  stars: number;
  gems: number;
}

const levels = campaignData.levels as CampaignLevel[];
const starRewards = campaignData.achievements.totalStarRewards as StarRewardTier[];

/** Returns all 90 campaign levels from the JSON data. */
export function getCampaignLevels(): CampaignLevel[] {
  return levels;
}

/** Returns a specific campaign level by its 1-based number. */
export function getCampaignLevel(levelNumber: number): CampaignLevel | undefined {
  return levels.find((l) => l.level === levelNumber);
}

/** Level 1 is always unlocked. Other levels require the previous level to be completed. */
export function isLevelUnlocked(levelNumber: number, progress: CampaignProgress): boolean {
  if (levelNumber === 1) return true;
  const prev = progress.levels.find((l) => l.levelNumber === levelNumber - 1);
  return prev?.completed === true;
}

/** Returns the progress entry for a specific level, if it exists. */
export function getLevelProgress(
  levelNumber: number,
  progress: CampaignProgress,
): CampaignLevelProgress | undefined {
  return progress.levels.find((l) => l.levelNumber === levelNumber);
}

/**
 * Updates progress with new stars for a level (only if better than existing).
 * Recalculates totalStars. Returns a new CampaignProgress object.
 */
export function completeCampaignLevel(
  progress: CampaignProgress,
  levelNumber: number,
  stars: number,
): CampaignProgress {
  const clampedStars = Math.max(0, Math.min(3, stars));
  const existing = progress.levels.find((l) => l.levelNumber === levelNumber);

  if (existing && existing.stars >= clampedStars) {
    return progress;
  }

  const updatedLevels: CampaignLevelProgress[] = existing
    ? progress.levels.map((l) =>
        l.levelNumber === levelNumber
          ? { ...l, stars: clampedStars, completed: clampedStars > 0 }
          : l,
      )
    : [
        ...progress.levels,
        { levelNumber, stars: clampedStars, completed: clampedStars > 0 },
      ];

  const totalStars = updatedLevels.reduce((sum, l) => sum + l.stars, 0);

  return { levels: updatedLevels, totalStars };
}

/** Returns achievement star reward tiers with whether each has been reached. */
export function getStarRewards(
  progress: CampaignProgress,
): Array<{ stars: number; gems: number; claimed: boolean }> {
  return starRewards.map((tier) => ({
    stars: tier.stars,
    gems: tier.gems,
    claimed: progress.totalStars >= tier.stars,
  }));
}

/** Returns total loot from all completed levels (levels where stars > 0). */
export function getTotalLootAvailable(
  progress: CampaignProgress,
): { gold: number; elixir: number; darkElixir: number } {
  const totals = { gold: 0, elixir: 0, darkElixir: 0 };

  for (const entry of progress.levels) {
    if (entry.stars <= 0) continue;
    const level = getCampaignLevel(entry.levelNumber);
    if (!level) continue;
    totals.gold += level.goldLoot;
    totals.elixir += level.elixirLoot;
    totals.darkElixir += level.darkElixirLoot;
  }

  return totals;
}

/** Returns the first level number that hasn't been completed, or null if all done. */
export function getNextUncompletedLevel(progress: CampaignProgress): number | null {
  for (const level of levels) {
    const entry = progress.levels.find((l) => l.levelNumber === level.level);
    if (!entry || entry.stars === 0) {
      return level.level;
    }
  }
  return null;
}
