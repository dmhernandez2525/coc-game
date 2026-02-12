import type { ResourceAmounts } from '../types/village.ts';
import { formatResource } from '../utils/resource-format.ts';

interface HUDProps {
  resources: ResourceAmounts;
  storageCaps: ResourceAmounts;
  builders: { idle: number; total: number };
  townHallLevel: number;
  trophies: number;
  onCollectAll?: () => void;
}

interface ResourceBadgeProps {
  label: string;
  value: number;
  cap: number;
  colorClass: string;
}

function ResourceBadge({ label, value, cap, colorClass }: ResourceBadgeProps) {
  const atCap = cap !== Infinity && value >= cap;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-lg">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`font-bold text-sm tabular-nums ${atCap ? 'text-red-400' : colorClass}`}>
        {formatResource(Math.floor(value))}
      </span>
      {cap !== Infinity && (
        <span className="text-xs text-slate-500">/ {formatResource(cap)}</span>
      )}
    </div>
  );
}

export function HUD({ resources, storageCaps, builders, townHallLevel, trophies, onCollectAll }: HUDProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-20 bg-slate-950/90 border-b border-slate-700 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2 max-w-5xl mx-auto">
        {/* Left: Resources */}
        <div className="flex items-center gap-2 flex-wrap">
          <ResourceBadge label="Gold" value={resources.gold} cap={storageCaps.gold} colorClass="text-yellow-400" />
          <ResourceBadge label="Elixir" value={resources.elixir} cap={storageCaps.elixir} colorClass="text-purple-400" />
          {townHallLevel >= 7 && (
            <ResourceBadge label="Dark" value={resources.darkElixir} cap={storageCaps.darkElixir} colorClass="text-slate-200" />
          )}
        </div>

        {/* Right: Gems, Builders, Trophies */}
        <div className="flex items-center gap-2">
          <ResourceBadge label="Gems" value={resources.gems} cap={Infinity} colorClass="text-emerald-400" />
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-lg">
            <span className="text-xs text-slate-400">Builders</span>
            <span className="font-bold text-sm text-amber-400 tabular-nums">
              {builders.idle}/{builders.total}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-lg">
            <span className="text-xs text-slate-400">Trophies</span>
            <span className="font-bold text-sm text-amber-300 tabular-nums">
              {trophies.toLocaleString()}
            </span>
          </div>
          {onCollectAll && (
            <button
              onClick={onCollectAll}
              className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold transition-colors"
            >
              Collect All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
