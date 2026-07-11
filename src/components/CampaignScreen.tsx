import { useState, useCallback } from 'react';
import type { Screen } from '../App';
import type { CampaignProgress, TrainedTroop } from '../types/village.ts';
import type { CampaignLevel } from '../engine/campaign-manager.ts';
import {
  getCampaignLevels,
  isLevelUnlocked,
  getLevelProgress,
  getStarRewards,
  getNextUncompletedLevel,
  calculateBattleStars,
  applyCampaignBattleResult,
} from '../engine/campaign-manager.ts';
import { simulateCampaignBattle } from '../engine/campaign-simulator.ts';

interface CampaignScreenProps {
  onNavigate: (screen: Screen) => void;
  campaignProgress: CampaignProgress;
  army: TrainedTroop[];
  onCampaignComplete: (
    levelNumber: number,
    stars: number,
    loot: { gold: number; elixir: number; darkElixir: number; gems?: number } | null,
  ) => void;
}

const MAX_STARS = 270;

function StarDisplay({ earned, max }: { earned: number; max: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < earned ? 'text-yellow-400' : 'text-gray-600'}>
          &#9733;
        </span>
      ))}
    </span>
  );
}

function LevelCard({
  level,
  stars,
  unlocked,
  onAttack,
}: {
  level: CampaignLevel;
  stars: number;
  unlocked: boolean;
  onAttack: (levelNumber: number) => void;
}) {
  return (
    <button
      disabled={!unlocked}
      onClick={() => onAttack(level.level)}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        unlocked
          ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 cursor-pointer'
          : 'border-slate-700 bg-slate-900 opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm text-slate-200">
          {level.level}. {level.name}
        </span>
        <StarDisplay earned={stars} max={level.maxStars} />
      </div>
      <div className="flex gap-3 text-xs text-slate-400">
        {level.goldLoot > 0 && (
          <span className="text-yellow-500">{level.goldLoot.toLocaleString()} gold</span>
        )}
        {level.elixirLoot > 0 && (
          <span className="text-purple-400">{level.elixirLoot.toLocaleString()} elixir</span>
        )}
        {level.darkElixirLoot > 0 && (
          <span className="text-indigo-400">{level.darkElixirLoot.toLocaleString()} DE</span>
        )}
      </div>
    </button>
  );
}

export function CampaignScreen({
  onNavigate,
  campaignProgress,
  army,
  onCampaignComplete,
}: CampaignScreenProps) {
  const [lastResult, setLastResult] = useState<string | null>(null);
  const levels = getCampaignLevels();
  const rewards = getStarRewards(campaignProgress);
  const nextLevel = getNextUncompletedLevel(campaignProgress);
  const nextMilestone = rewards.find((r) => !r.claimed) ?? null;

  const hasArmy = army.some((t) => t.count > 0);

  const handleAttack = useCallback(
    (levelNumber: number) => {
      if (!hasArmy) {
        setLastResult('You need troops to attack! Train an army first.');
        return;
      }

      const result = simulateCampaignBattle(army, levelNumber);
      if (!result) {
        setLastResult('Failed to start battle.');
        return;
      }

      const levelData = levels.find((l) => l.level === levelNumber);
      const name = levelData?.name ?? `Level ${levelNumber}`;

      // Canonical star rules: 1 star for 50%, 1 star for the Town Hall, 3 at 100%
      const stars = calculateBattleStars(result.destructionPercent, result.townHallDestroyed);

      // Campaign rules: loot on first clear only, milestone gems at star
      // thresholds, and never any trophy change
      const rewards = applyCampaignBattleResult(campaignProgress, levelNumber, stars);
      onCampaignComplete(levelNumber, stars, { ...rewards.loot, gems: rewards.gemsAwarded });

      if (stars === 0) {
        setLastResult(
          `Attacked "${name}" but only achieved ${result.destructionPercent}% destruction. No stars earned. Try training a stronger army!`,
        );
        return;
      }

      const lootMsg = rewards.firstClear
        ? ` First clear! Looted ${rewards.loot.gold.toLocaleString()} gold, ${rewards.loot.elixir.toLocaleString()} elixir.`
        : ' Replay: level loot was already collected.';
      const gemMsg = rewards.gemsAwarded > 0
        ? ` Star milestone reached: +${rewards.gemsAwarded} gems!`
        : '';
      setLastResult(
        `Attacked "${name}" with ${result.destructionPercent}% destruction and earned ${stars} star${stars > 1 ? 's' : ''}!${lootMsg}${gemMsg}`,
      );
    },
    [army, hasArmy, levels, campaignProgress, onCampaignComplete],
  );

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => onNavigate('village')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            Back to Village
          </button>
          <h1 className="text-2xl font-bold text-slate-100">Campaign</h1>
          <span className="text-sm text-slate-400">
            {campaignProgress.totalStars} / {MAX_STARS} &#9733;
          </span>
        </div>

        {/* Army status */}
        {!hasArmy && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-200 text-center">
            No troops trained! Go back to your village and train an army before attacking.
          </div>
        )}

        {hasArmy && (
          <div className="mb-4 p-3 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-300 text-center">
            Army: {army.filter((t) => t.count > 0).map((t) => `${t.name} x${t.count}`).join(', ')}
          </div>
        )}

        {/* Gem milestone tiers */}
        <div className="flex gap-2 mb-2 justify-center flex-wrap">
          {rewards.map((r) => (
            <div
              key={r.stars}
              title={
                r.claimed
                  ? `Milestone reached: ${r.gems} gems awarded`
                  : `Reach ${r.stars} total stars to earn ${r.gems} gems`
              }
              className={`px-3 py-1 rounded text-xs font-medium ${
                r.claimed
                  ? 'bg-green-800 text-green-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {r.stars}&#9733; = {r.gems} gems {r.claimed ? '(earned)' : ''}
            </div>
          ))}
        </div>

        {/* Next milestone progress */}
        {nextMilestone && (
          <p className="mb-4 text-xs text-slate-400 text-center">
            {nextMilestone.stars - campaignProgress.totalStars} more star
            {nextMilestone.stars - campaignProgress.totalStars === 1 ? '' : 's'} to the next
            milestone (+{nextMilestone.gems} gems)
          </p>
        )}
        {!nextMilestone && (
          <p className="mb-4 text-xs text-green-300 text-center">
            All gem milestones earned!
          </p>
        )}

        {/* Last attack result */}
        {lastResult && (
          <div className="mb-4 p-3 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 text-center">
            {lastResult}
          </div>
        )}

        {/* Next level hint */}
        {nextLevel !== null && (
          <p className="mb-3 text-xs text-slate-500 text-center">
            Next uncompleted: Level {nextLevel}
          </p>
        )}

        {/* Level list */}
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
          {levels.map((level) => {
            const lp = getLevelProgress(level.level, campaignProgress);
            return (
              <LevelCard
                key={level.level}
                level={level}
                stars={lp?.stars ?? 0}
                unlocked={isLevelUnlocked(level.level, campaignProgress)}
                onAttack={handleAttack}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
