import type { DefenseLogEntry } from '../types/village.ts';

interface DefenseLogPanelProps {
  entries: DefenseLogEntry[];
  onSimulate: () => void;
  onClose: () => void;
}

function lootSummary(entry: DefenseLogEntry): string {
  const parts = [
    entry.lootStolen.gold > 0 ? `${entry.lootStolen.gold.toLocaleString()} gold` : '',
    entry.lootStolen.elixir > 0 ? `${entry.lootStolen.elixir.toLocaleString()} elixir` : '',
    entry.lootStolen.darkElixir > 0 ? `${entry.lootStolen.darkElixir.toLocaleString()} dark elixir` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'No loot lost';
}

export function DefenseLogPanel({ entries, onSimulate, onClose }: DefenseLogPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 max-w-full bg-slate-900/95 border-l-2 border-red-500/60 backdrop-blur-sm flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-red-300">Defense Log</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close defense log"
        >
          x
        </button>
      </div>

      <div className="p-4 border-b border-slate-700">
        <button
          onClick={onSimulate}
          className="w-full px-4 py-2 bg-red-700 hover:bg-red-600 rounded font-semibold text-sm transition-colors"
        >
          Simulate Incoming Raid
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-slate-400">No defenses recorded.</p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-100">{entry.attackerName}</span>
              <span className={entry.result === 'victory' ? 'text-emerald-400' : 'text-red-400'}>
                {entry.result === 'victory' ? 'Defense won' : 'Defense lost'}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-400 space-y-1">
              <p>{entry.stars} stars, {entry.destructionPercent}% destruction, {entry.durationSeconds}s</p>
              <p>{entry.trophyChange >= 0 ? '+' : ''}{entry.trophyChange} trophies, {lootSummary(entry)}</p>
              <p>{entry.trapsTriggered.length > 0
                ? `Triggered: ${entry.trapsTriggered.join(', ')}`
                : 'No traps triggered'}</p>
              <p>{new Date(entry.timestamp).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
