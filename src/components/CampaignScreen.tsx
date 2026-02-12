import { useState, useCallback } from 'react';
import type { Screen } from '../App';
import type { CampaignProgress } from '../types/village.ts';
import type { CampaignLevel } from '../engine/campaign-manager.ts';
import {
  getCampaignLevels,
  isLevelUnlocked,
  getLevelProgress,
  completeCampaignLevel,
  getStarRewards,
  getNextUncompletedLevel,
} from '../engine/campaign-manager.ts';

interface CampaignScreenProps {
  onNavigate: (screen: Screen) => void;
}

const EMPTY_PROGRESS: CampaignProgress = { levels: [], totalStars: 0 };
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

export function CampaignScreen({ onNavigate }: CampaignScreenProps) {
  const [progress, setProgress] = useState<CampaignProgress>(EMPTY_PROGRESS);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const levels = getCampaignLevels();
  const rewards = getStarRewards(progress);
  const nextLevel = getNextUncompletedLevel(progress);

  const handleAttack = useCallback(
    (levelNumber: number) => {
      const stars = Math.floor(Math.random() * 3) + 1;
      const updated = completeCampaignLevel(progress, levelNumber, stars);
      setProgress(updated);

      const levelData = levels.find((l) => l.level === levelNumber);
      const name = levelData?.name ?? `Level ${levelNumber}`;
      setLastResult(`Attacked "${name}" and earned ${stars} star${stars > 1 ? 's' : ''}!`);
    },
    [progress, levels],
  );

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => onNavigate('menu')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            Back to Menu
          </button>
          <h1 className="text-2xl font-bold text-slate-100">Campaign</h1>
          <span className="text-sm text-slate-400">
            {progress.totalStars} / {MAX_STARS} &#9733;
          </span>
        </div>

        {/* Star reward tiers */}
        <div className="flex gap-2 mb-4 justify-center">
          {rewards.map((r) => (
            <div
              key={r.stars}
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
            const lp = getLevelProgress(level.level, progress);
            return (
              <LevelCard
                key={level.level}
                level={level}
                stars={lp?.stars ?? 0}
                unlocked={isLevelUnlocked(level.level, progress)}
                onAttack={handleAttack}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
