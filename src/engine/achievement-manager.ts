// Achievement system that tracks player milestones across multiple tiers.
// All functions are pure: they return new state, never mutate.

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'resource' | 'building' | 'campaign';
  tiers: Array<{ target: number; gemReward: number }>;
}

export interface AchievementProgress {
  achievementId: string;
  currentValue: number;
  claimedTier: number; // 0 = none claimed, 1 = first tier claimed, etc.
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'sweet_victory',
    name: 'Sweet Victory',
    description: 'Earn trophies from multiplayer battles',
    category: 'combat',
    tiers: [
      { target: 75, gemReward: 5 },
      { target: 750, gemReward: 10 },
      { target: 1250, gemReward: 450 },
    ],
  },
  {
    id: 'empire_builder',
    name: 'Empire Builder',
    description: 'Upgrade buildings',
    category: 'building',
    tiers: [
      { target: 20, gemReward: 5 },
      { target: 100, gemReward: 10 },
      { target: 500, gemReward: 250 },
    ],
  },
  {
    id: 'gold_grab',
    name: 'Gold Grab',
    description: 'Collect gold from battles',
    category: 'resource',
    tiers: [
      { target: 25_000, gemReward: 5 },
      { target: 500_000, gemReward: 10 },
      { target: 10_000_000, gemReward: 250 },
    ],
  },
  {
    id: 'elixir_escapade',
    name: 'Elixir Escapade',
    description: 'Collect elixir from battles',
    category: 'resource',
    tiers: [
      { target: 25_000, gemReward: 5 },
      { target: 500_000, gemReward: 10 },
      { target: 10_000_000, gemReward: 250 },
    ],
  },
  {
    id: 'heroic',
    name: 'Heroic Heist',
    description: 'Collect Dark Elixir from battles',
    category: 'resource',
    tiers: [
      { target: 250, gemReward: 10 },
      { target: 2_500, gemReward: 20 },
      { target: 250_000, gemReward: 500 },
    ],
  },
  {
    id: 'get_those_goblins',
    name: 'Get Those Goblins',
    description: 'Earn stars from campaign',
    category: 'campaign',
    tiers: [
      { target: 45, gemReward: 10 },
      { target: 90, gemReward: 10 },
      { target: 150, gemReward: 15 },
    ],
  },
  {
    id: 'unbreakable',
    name: 'Unbreakable',
    description: 'Win defenses',
    category: 'combat',
    tiers: [
      { target: 10, gemReward: 5 },
      { target: 250, gemReward: 10 },
      { target: 5_000, gemReward: 500 },
    ],
  },
  {
    id: 'conqueror',
    name: 'Conqueror',
    description: 'Win stars from battles',
    category: 'combat',
    tiers: [
      { target: 10, gemReward: 5 },
      { target: 75, gemReward: 10 },
      { target: 500, gemReward: 250 },
    ],
  },
];

/** Look up an achievement definition by its id. */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Updates or creates a progress entry. Only increases, never decrements. */
export function updateAchievementProgress(
  progress: AchievementProgress[],
  achievementId: string,
  newValue: number,
): AchievementProgress[] {
  const existing = progress.find((p) => p.achievementId === achievementId);

  if (existing) {
    if (newValue <= existing.currentValue) return progress;
    return progress.map((p) =>
      p.achievementId === achievementId ? { ...p, currentValue: newValue } : p,
    );
  }

  return [...progress, { achievementId, currentValue: newValue, claimedTier: 0 }];
}

/** Returns tiers that have been reached but not yet claimed. */
export function getClaimableRewards(
  progress: AchievementProgress[],
): Array<{ achievementId: string; tierIndex: number; gemReward: number }> {
  const results: Array<{ achievementId: string; tierIndex: number; gemReward: number }> = [];

  for (const entry of progress) {
    const achievement = getAchievement(entry.achievementId);
    if (!achievement) continue;

    for (let i = entry.claimedTier; i < achievement.tiers.length; i++) {
      const tier = achievement.tiers[i];
      if (!tier) continue;
      if (entry.currentValue < tier.target) break;
      results.push({ achievementId: entry.achievementId, tierIndex: i, gemReward: tier.gemReward });
    }
  }

  return results;
}

/** Claims the next unclaimed tier. Returns updated progress and gems earned. */
export function claimReward(
  progress: AchievementProgress[],
  achievementId: string,
): { progress: AchievementProgress[]; gemsEarned: number } {
  const entry = progress.find((p) => p.achievementId === achievementId);
  if (!entry) return { progress, gemsEarned: 0 };

  const achievement = getAchievement(achievementId);
  if (!achievement) return { progress, gemsEarned: 0 };

  const nextTierIndex = entry.claimedTier;
  const nextTier = achievement.tiers[nextTierIndex];
  if (!nextTier) return { progress, gemsEarned: 0 };
  if (entry.currentValue < nextTier.target) return { progress, gemsEarned: 0 };

  const updated = progress.map((p) =>
    p.achievementId === achievementId ? { ...p, claimedTier: p.claimedTier + 1 } : p,
  );

  return { progress: updated, gemsEarned: nextTier.gemReward };
}

/** Sum of all claimed tier rewards across all achievements. */
export function getTotalGemsEarned(progress: AchievementProgress[]): number {
  let total = 0;

  for (const entry of progress) {
    const achievement = getAchievement(entry.achievementId);
    if (!achievement) continue;

    for (let i = 0; i < entry.claimedTier; i++) {
      const tier = achievement.tiers[i];
      if (tier) total += tier.gemReward;
    }
  }

  return total;
}
