import type { BattleResult } from '../types/battle.ts';
import { formatResource } from '../utils/resource-format.ts';

interface BattleResultScreenProps {
  result: BattleResult;
  onReturnHome: () => void;
}

function ResultStar({ filled }: { filled: boolean }) {
  return (
    <div
      className={`w-16 h-16 rounded-full border-3 flex items-center justify-center text-3xl font-bold transition-all ${
        filled
          ? 'border-amber-400 bg-amber-400 text-slate-900 scale-110 shadow-lg shadow-amber-400/30'
          : 'border-slate-600 bg-slate-800 text-slate-600'
      }`}
    >
      ★
    </div>
  );
}

const lootRows: Array<{ key: keyof BattleResult['loot']; label: string; colorClass: string }> = [
  { key: 'gold', label: 'Gold', colorClass: 'text-yellow-400' },
  { key: 'elixir', label: 'Elixir', colorClass: 'text-purple-400' },
  { key: 'darkElixir', label: 'Dark Elixir', colorClass: 'text-slate-200' },
];

export function BattleResultScreen({ result, onReturnHome }: BattleResultScreenProps) {
  const isVictory = result.stars > 0;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        <h2 className={`text-2xl font-bold mb-4 ${isVictory ? 'text-amber-400' : 'text-red-400'}`}>
          {isVictory ? 'Victory!' : 'Defeat'}
        </h2>

        {/* Stars */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <ResultStar filled={result.stars >= 1} />
          <ResultStar filled={result.stars >= 2} />
          <ResultStar filled={result.stars >= 3} />
        </div>

        {/* Destruction */}
        <p className="text-4xl font-bold text-white tabular-nums mb-6">
          {result.destructionPercent.toFixed(0)}%
          <span className="text-sm text-slate-400 ml-2 font-normal">destroyed</span>
        </p>

        {/* Loot table */}
        <div className="space-y-2 mb-6">
          {lootRows.map(({ key, label, colorClass }) => (
            <div key={key} className="flex items-center justify-between px-4 py-1.5 bg-slate-800 rounded-lg">
              <span className="text-sm text-slate-400">{label}</span>
              <span className={`font-bold tabular-nums ${colorClass}`}>
                +{formatResource(result.loot[key])}
              </span>
            </div>
          ))}
        </div>

        {/* Trophy change */}
        <p className={`text-lg font-bold mb-6 tabular-nums ${result.trophyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {result.trophyChange >= 0 ? '+' : ''}{result.trophyChange} Trophies
        </p>

        <button
          onClick={onReturnHome}
          className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold text-lg transition-colors"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
