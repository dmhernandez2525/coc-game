import { useState } from 'react';
import type { ClanState } from '../engine/clan-manager.ts';
import {
  CLAN_BADGES,
  getCastleCapacity,
  getCastleHousingUsed,
  getAvailableClanPerks,
  getXPForNextLevel,
} from '../engine/clan-manager.ts';

interface ClanPanelProps {
  clan: ClanState | null;
  townHallLevel: number;
  onCreateClan: (name: string) => void;
  onClose: () => void;
}

const PERK_LABELS: Record<string, string> = {
  troopDonationCapacity: 'Troop Donation Capacity',
  donationUpgradeBonus: 'Donation Upgrade Bonus',
  treasuryStorageBonus: 'Treasury Storage Bonus',
};

function CreateClanForm({ onCreateClan }: { onCreateClan: (name: string) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onCreateClan(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
      <h3 className="text-base font-semibold text-slate-300">Create a Clan</h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Clan name"
        maxLength={30}
        className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
      />
      <button
        type="submit"
        disabled={name.trim().length === 0}
        className="px-4 py-2 rounded font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Create
      </button>
    </form>
  );
}

function ClanDetails({ clan, townHallLevel }: { clan: ClanState; townHallLevel: number }) {
  const xpNeeded = getXPForNextLevel(clan.level);
  const xpPercent = xpNeeded > 0 ? Math.min((clan.xp / xpNeeded) * 100, 100) : 100;
  const capacity = getCastleCapacity(townHallLevel);
  const used = getCastleHousingUsed(clan);
  const perks = getAvailableClanPerks(clan.level);
  const badgeName = CLAN_BADGES[clan.badgeIndex] ?? 'Shield';

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Clan identity */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 flex items-center justify-center rounded bg-slate-700 text-amber-400 text-xs font-bold">
          {badgeName}
        </span>
        <div>
          <h3 className="text-base font-bold text-white">{clan.name}</h3>
          <span className="text-sm text-slate-400">Level {clan.level}</span>
        </div>
      </div>

      {/* XP progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>XP</span>
          <span>{xpNeeded > 0 ? `${clan.xp} / ${xpNeeded}` : 'Max Level'}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      {/* Perks */}
      <div>
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Active Perks
        </h4>
        {perks.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No perks unlocked yet.</p>
        ) : (
          <div className="space-y-1">
            {perks.map((p) => (
              <div key={p.perkName} className="flex justify-between bg-slate-800 rounded px-3 py-1.5 text-sm">
                <span className="text-slate-300">{PERK_LABELS[p.perkName] ?? p.perkName}</span>
                <span className="text-amber-300 font-semibold">+{p.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Castle troops */}
      <div>
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Castle Troops
          <span className="ml-2 text-xs font-normal text-slate-500">
            {used} / {capacity}
          </span>
        </h4>
        {clan.castleTroops.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No troops in castle.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {clan.castleTroops.map((t) => (
              <div key={t.name} className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                <span className="text-sm text-white">{t.name}</span>
                <span className="text-xs text-amber-300">x{t.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClanPanel({ clan, townHallLevel, onCreateClan, onClose }: ClanPanelProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-400">Clan</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close panel"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {clan ? (
            <ClanDetails clan={clan} townHallLevel={townHallLevel} />
          ) : (
            <CreateClanForm onCreateClan={onCreateClan} />
          )}
        </div>
      </div>
    </div>
  );
}
