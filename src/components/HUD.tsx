import type { ResourceAmounts } from '../types/village.ts';

interface HUDProps {
  resources: ResourceAmounts;
  builders: { idle: number; total: number };
  townHallLevel: number;
  trophies: number;
}

interface ResourceBadgeProps {
  label: string;
  value: number;
  colorClass: string;
}

function ResourceBadge({ label, value, colorClass }: ResourceBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-lg">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`font-bold text-sm tabular-nums ${colorClass}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export function HUD({ resources, builders, townHallLevel, trophies }: HUDProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-20 bg-slate-950/90 border-b border-slate-700 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2 max-w-5xl mx-auto">
        {/* Left: Resources */}
        <div className="flex items-center gap-2 flex-wrap">
          <ResourceBadge label="Gold" value={resources.gold} colorClass="text-yellow-400" />
          <ResourceBadge label="Elixir" value={resources.elixir} colorClass="text-purple-400" />
          {townHallLevel >= 7 && (
            <ResourceBadge
              label="Dark"
              value={resources.darkElixir}
              colorClass="text-slate-200"
            />
          )}
        </div>

        {/* Right: Gems, Builders, Trophies */}
        <div className="flex items-center gap-2">
          <ResourceBadge label="Gems" value={resources.gems} colorClass="text-emerald-400" />
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
        </div>
      </div>
    </div>
  );
}
