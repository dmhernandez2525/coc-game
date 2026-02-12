import type { GameStatistics } from '../engine/statistics-tracker.ts';
import { getStatLabel } from '../engine/statistics-tracker.ts';

interface StatsPanelProps {
  stats: GameStatistics;
  onClose: () => void;
}

interface StatSection {
  title: string;
  keys: (keyof GameStatistics)[];
}

const STAT_SECTIONS: readonly StatSection[] = [
  {
    title: 'Combat',
    keys: ['totalAttacks', 'totalDefenses', 'totalStarsEarned', 'highestTrophies'],
  },
  {
    title: 'Resources',
    keys: ['totalGoldLooted', 'totalElixirLooted', 'totalDarkElixirLooted'],
  },
  {
    title: 'Progress',
    keys: ['buildingsUpgraded', 'troopsTrained', 'spellsUsed', 'obstaclesRemoved'],
  },
];

export function StatsPanel({ stats, onClose }: StatsPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-400">Statistics</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close stats"
        >
          x
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {STAT_SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.keys.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
                >
                  <span className="text-sm text-slate-300">{getStatLabel(key)}</span>
                  <span className="text-sm font-semibold text-amber-300">
                    {stats[key].toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
