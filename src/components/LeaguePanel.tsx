import { useMemo } from 'react';
import type { TreasuryAmounts } from '../types/village.ts';
import {
  getAllLeagues,
  getTrophyRange,
  getLeagueBonus,
  getStarBonus,
  STAR_BONUS_STARS_REQUIRED,
} from '../engine/trophy-manager.ts';
import { formatResource } from '../utils/resource-format.ts';

interface LeaguePanelProps {
  league: string;
  trophies: number;
  starBonusStars: number;
  treasury: TreasuryAmounts;
  treasuryCapacity: TreasuryAmounts;
  onClaimStarBonus: () => void;
  onCollectTreasury: () => void;
  onClose: () => void;
}

function LootRow({ label, gold, elixir, darkElixir }: {
  label: string;
  gold: number;
  elixir: number;
  darkElixir: number;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="flex gap-2 tabular-nums">
        <span className="text-yellow-400">{formatResource(gold)}</span>
        <span className="text-purple-400">{formatResource(elixir)}</span>
        <span className="text-slate-200">{formatResource(darkElixir)}</span>
      </span>
    </div>
  );
}

export function LeaguePanel({
  league,
  trophies,
  starBonusStars,
  treasury,
  treasuryCapacity,
  onClaimStarBonus,
  onCollectTreasury,
  onClose,
}: LeaguePanelProps) {
  const leagues = useMemo(() => getAllLeagues(), []);
  const currentRange = getTrophyRange(league);
  const leagueBonus = getLeagueBonus(league);
  const starBonus = getStarBonus(league);

  const starBonusReady = starBonusStars >= STAR_BONUS_STARS_REQUIRED;
  const treasuryEmpty = treasury.gold === 0 && treasury.elixir === 0 && treasury.darkElixir === 0;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="text-lg font-bold text-amber-400">League</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close league"
        >
          x
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Current league */}
        <div className="px-3 py-2.5 rounded-lg bg-slate-800 border border-sky-500/40">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sky-300">{league}</span>
            <span className="text-xs text-amber-300 tabular-nums">
              {trophies.toLocaleString()} trophies
            </span>
          </div>
          {currentRange && (
            <p className="text-xs text-slate-400 mt-1">
              Range: {currentRange.min.toLocaleString()}
              {currentRange.max === Infinity ? '+' : ` to ${currentRange.max.toLocaleString()}`}
            </p>
          )}
          {leagueBonus && (
            <div className="mt-2 space-y-1">
              <LootRow label="Win bonus (max)" {...leagueBonus} />
            </div>
          )}
        </div>

        {/* Star bonus */}
        <div className="px-3 py-2.5 rounded-lg bg-slate-800 border border-amber-500/40">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm text-amber-300">Star Bonus</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 tabular-nums">
              {starBonusStars} / {STAR_BONUS_STARS_REQUIRED} stars
            </span>
          </div>
          {starBonus && (
            <div className="mb-2">
              <LootRow
                label="Reward"
                gold={starBonus.goldElixir}
                elixir={starBonus.goldElixir}
                darkElixir={starBonus.darkElixir}
              />
            </div>
          )}
          <button
            onClick={onClaimStarBonus}
            disabled={!starBonusReady}
            className={`w-full text-center text-xs font-semibold py-1.5 rounded transition-colors ${
              starBonusReady
                ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            }`}
          >
            {starBonusReady ? 'Claim to Treasury' : 'Earn stars in battle'}
          </button>
        </div>

        {/* Treasury */}
        <div className="px-3 py-2.5 rounded-lg bg-slate-800 border border-emerald-500/40">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm text-emerald-300">Treasury</span>
            <span className="text-xs text-slate-500">3% stealable</span>
          </div>
          <div className="space-y-1 mb-2">
            <LootRow label="Stored" {...treasury} />
            <LootRow label="Capacity" {...treasuryCapacity} />
          </div>
          <button
            onClick={onCollectTreasury}
            disabled={treasuryEmpty}
            className={`w-full text-center text-xs font-semibold py-1.5 rounded transition-colors ${
              !treasuryEmpty
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            }`}
          >
            Collect
          </button>
        </div>

        {/* League ladder */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">All Leagues</p>
          <div className="space-y-1">
            {leagues.map((tier) => (
              <div
                key={tier.league}
                className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${
                  tier.league === league
                    ? 'bg-sky-900/40 border border-sky-500/40 text-sky-200'
                    : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                <span>{tier.league}</span>
                <span className="tabular-nums">{tier.trophyRange}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
