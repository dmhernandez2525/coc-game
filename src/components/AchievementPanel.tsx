import { useState, useMemo } from 'react';
import type { Achievement, AchievementProgress } from '../engine/achievement-manager.ts';
import {
  ACHIEVEMENTS,
  getClaimableRewards,
  getTotalGemsEarned,
} from '../engine/achievement-manager.ts';

type CategoryFilter = 'all' | Achievement['category'];

interface AchievementPanelProps {
  progress: AchievementProgress[];
  onClaimReward: (achievementId: string) => void;
  onClose: () => void;
}

const CATEGORY_TABS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'combat', label: 'Combat' },
  { key: 'resource', label: 'Resource' },
  { key: 'building', label: 'Building' },
  { key: 'campaign', label: 'Campaign' },
];

function getProgressEntry(
  progress: AchievementProgress[],
  achievementId: string,
): AchievementProgress {
  return (
    progress.find((p) => p.achievementId === achievementId) ?? {
      achievementId,
      currentValue: 0,
      claimedTier: 0,
    }
  );
}

function AchievementCard({
  achievement,
  entry,
  claimable,
  onClaim,
}: {
  achievement: Achievement;
  entry: AchievementProgress;
  claimable: boolean;
  onClaim: () => void;
}) {
  const allTiersClaimed = entry.claimedTier >= achievement.tiers.length;
  const allTiersReached =
    achievement.tiers.length > 0 &&
    entry.currentValue >= (achievement.tiers[achievement.tiers.length - 1]?.target ?? 0);
  const isFullyComplete = allTiersClaimed && allTiersReached;

  // Determine the next relevant tier (the one after the last claimed)
  const nextTierIndex = entry.claimedTier;
  const nextTier = achievement.tiers[nextTierIndex];

  // Progress bar: measure toward the next unclaimed tier
  const progressTarget = nextTier?.target ?? achievement.tiers[achievement.tiers.length - 1]?.target ?? 1;
  const progressPercent = Math.min((entry.currentValue / progressTarget) * 100, 100);

  return (
    <div
      className={`rounded-lg px-3 py-3 transition-colors ${
        isFullyComplete
          ? 'bg-green-900/30 border border-green-600/40'
          : claimable
            ? 'bg-amber-900/30 border border-amber-500/50'
            : 'bg-slate-800'
      }`}
    >
      {/* Top row: name + status */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm text-white">{achievement.name}</span>
        {isFullyComplete && <span className="text-green-400 text-sm" aria-label="Completed">✓</span>}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 mb-2">{achievement.description}</p>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>
            Tier {Math.min(entry.claimedTier + 1, achievement.tiers.length)} of {achievement.tiers.length}
          </span>
          <span>
            {entry.currentValue.toLocaleString()} / {progressTarget.toLocaleString()}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isFullyComplete ? 'bg-green-500' : claimable ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Reward + claim */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {nextTier
            ? `Reward: ${nextTier.gemReward} gems`
            : 'All tiers completed'}
        </span>
        {claimable && (
          <button
            onClick={onClaim}
            className="px-3 py-1 rounded text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            Claim
          </button>
        )}
      </div>
    </div>
  );
}

export function AchievementPanel({ progress, onClaimReward, onClose }: AchievementPanelProps) {
  const [category, setCategory] = useState<CategoryFilter>('all');

  const totalGems = useMemo(() => getTotalGemsEarned(progress), [progress]);

  const claimableSet = useMemo(() => {
    const rewards = getClaimableRewards(progress);
    return new Set(rewards.map((r) => r.achievementId));
  }, [progress]);

  const filtered = useMemo(() => {
    if (category === 'all') return ACHIEVEMENTS;
    return ACHIEVEMENTS.filter((a) => a.category === category);
  }, [category]);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div>
          <h3 className="text-lg font-bold text-amber-400">Achievements</h3>
          <p className="text-xs text-slate-400">
            Total gems earned: <span className="text-green-400 font-semibold">{totalGems.toLocaleString()}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close achievements"
        >
          x
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-slate-700">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setCategory(t.key)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              category === t.key
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Achievement list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map((achievement) => {
          const entry = getProgressEntry(progress, achievement.id);
          const isClaimable = claimableSet.has(achievement.id);

          return (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              entry={entry}
              claimable={isClaimable}
              onClaim={() => onClaimReward(achievement.id)}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-slate-500 py-8 text-sm">
            No achievements in this category.
          </p>
        )}
      </div>
    </div>
  );
}
