import type { BattleState } from '../types/battle.ts';
import { formatResource } from '../utils/resource-format.ts';

interface BattleHUDProps {
  state: BattleState;
  selectedTroop: string | null;
  onDeployTroop: (troopName: string) => void;
  onSurrender: () => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
        filled
          ? 'border-amber-400 bg-amber-400 text-slate-900'
          : 'border-slate-500 bg-slate-800 text-slate-500'
      }`}
    >
      ★
    </div>
  );
}

export function BattleHUD({ state, selectedTroop, onDeployTroop, onSurrender }: BattleHUDProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top bar */}
      <div className="pointer-events-auto flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold text-amber-400 tabular-nums">
            {formatTimer(state.timeRemaining)}
          </span>
          <span className="text-sm font-semibold text-slate-300">
            {state.destructionPercent.toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <StarIcon filled={state.stars >= 1} />
          <StarIcon filled={state.stars >= 2} />
          <StarIcon filled={state.stars >= 3} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-yellow-400">{formatResource(state.loot.gold)} G</span>
            <span className="text-purple-400">{formatResource(state.loot.elixir)} E</span>
            <span className="text-slate-300">{formatResource(state.loot.darkElixir)} DE</span>
          </div>
          <button
            onClick={onSurrender}
            className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs font-semibold transition-colors"
          >
            Surrender
          </button>
        </div>
      </div>

      {/* Bottom bar: troop deployment */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/90 border-t border-slate-700 overflow-x-auto">
          {state.availableTroops.map((troop) => (
            <button
              key={troop.name}
              onClick={() => onDeployTroop(troop.name)}
              disabled={troop.count <= 0}
              className={`flex flex-col items-center px-3 py-2 rounded-lg min-w-[72px] transition-colors ${
                selectedTroop === troop.name
                  ? 'bg-amber-600 text-white'
                  : troop.count > 0
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span className="text-xs font-semibold truncate max-w-[64px]">{troop.name}</span>
              <span className="text-[10px] tabular-nums mt-0.5">x{troop.count}</span>
            </button>
          ))}
          {state.availableTroops.length === 0 && (
            <span className="text-sm text-slate-500 italic">No troops available</span>
          )}
        </div>
      </div>
    </div>
  );
}
