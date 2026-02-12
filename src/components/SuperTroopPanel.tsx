import { useMemo } from 'react';
import type { SuperTroopState } from '../engine/super-troop-manager.ts';
import {
  getAllSuperTroops,
  canBoost,
  isTroopBoosted,
  getMaxActiveBoosts,
} from '../engine/super-troop-manager.ts';

interface SuperTroopPanelProps {
  superTroopState: SuperTroopState;
  townHallLevel: number;
  darkElixir: number;
  onBoost: (superTroopName: string) => void;
  onUnboost: (superTroopName: string) => void;
  onClose: () => void;
}

function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

type BoostStatus = 'available' | 'active' | 'locked';

function getBoostStatus(
  state: SuperTroopState,
  superTroopName: string,
  baseTroopName: string,
  thLevel: number,
  darkElixir: number,
): BoostStatus {
  if (isTroopBoosted(state, baseTroopName)) return 'active';
  if (canBoost(state, superTroopName, thLevel, darkElixir)) return 'available';
  return 'locked';
}

export function SuperTroopPanel({
  superTroopState,
  townHallLevel,
  darkElixir,
  onBoost,
  onUnboost,
  onClose,
}: SuperTroopPanelProps) {
  const allSuperTroops = useMemo(() => getAllSuperTroops(), []);
  const maxBoosts = getMaxActiveBoosts();
  const activeCount = superTroopState.activeBoosts.length;

  const activeBoostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const boost of superTroopState.activeBoosts) {
      map.set(boost.superTroopName, boost.remainingDurationMs);
    }
    return map;
  }, [superTroopState.activeBoosts]);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-amber-400">Super Troops</h3>
          <span className="text-sm px-2 py-0.5 rounded bg-slate-700 text-slate-300">
            {activeCount}/{maxBoosts} Active
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close super troops"
        >
          x
        </button>
      </div>

      {/* Super troop list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {allSuperTroops.map((st) => {
          const status = getBoostStatus(
            superTroopState,
            st.name,
            st.baseTroop,
            townHallLevel,
            darkElixir,
          );
          const remainingMs = activeBoostMap.get(st.name);

          return (
            <div
              key={st.name}
              className={`rounded-lg px-3 py-2 transition-colors ${
                status === 'active'
                  ? 'bg-amber-900/30 border border-amber-500/40'
                  : 'bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">{st.name}</span>
                  <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                    <span>Base: {st.baseTroop}</span>
                    <span>Space: {st.housingSpace}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                    <span className="text-purple-400">
                      {st.boostCost.toLocaleString()} Dark Elixir
                    </span>
                    <span>TH {st.thRequired}</span>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {status === 'active' && (
                    <button
                      onClick={() => onUnboost(st.name)}
                      className="px-3 py-1 rounded text-xs font-semibold bg-amber-600/80 text-amber-100 hover:bg-amber-600 transition-colors"
                    >
                      Active
                    </button>
                  )}
                  {status === 'available' && (
                    <button
                      onClick={() => onBoost(st.name)}
                      className="px-3 py-1 rounded text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                    >
                      Boost
                    </button>
                  )}
                  {status === 'locked' && (
                    <span className="px-3 py-1 rounded text-xs font-semibold bg-slate-700 text-slate-500">
                      Locked
                    </span>
                  )}
                </div>
              </div>
              {status === 'active' && remainingMs != null && (
                <div className="mt-1 text-xs text-amber-300">
                  {formatRemainingTime(remainingMs)} remaining
                </div>
              )}
            </div>
          );
        })}
        {allSuperTroops.length === 0 && (
          <p className="text-center text-slate-500 py-8 text-sm">
            No super troops available.
          </p>
        )}
      </div>
    </div>
  );
}
