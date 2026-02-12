import { useState } from 'react';
import type { WarState, WarResult, WarClanMember } from '../engine/clan-war-manager.ts';
import { getWarSizes, calculateWarLoot } from '../engine/clan-war-manager.ts';

interface ClanWarPanelProps {
  war: WarState | null;
  clanName: string | null;
  townHallLevel: number;
  onStartWar: (warSize: number) => void;
  onAttack: (defenderIndex: number) => void;
  onEndWar: () => void;
  onClose: () => void;
}

const RESULT_STYLES: Record<WarResult, { label: string; color: string }> = {
  victory: { label: 'Victory', color: 'text-green-400' },
  defeat: { label: 'Defeat', color: 'text-red-400' },
  draw: { label: 'Draw', color: 'text-yellow-400' },
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function StarDisplay({ count, max }: { count: number; max: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={i < count ? 'text-amber-400' : 'text-slate-600'}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function MemberRow({ member, index }: { member: WarClanMember; index: number }) {
  return (
    <div className="flex items-center justify-between bg-slate-800 rounded px-3 py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-5 text-right">{index + 1}.</span>
        <span className="text-white">{member.name}</span>
        <span className="text-xs text-amber-300 bg-slate-700 rounded px-1.5 py-0.5">
          TH{member.townHallLevel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <StarDisplay count={member.bestAttackStars} max={3} />
        {member.bestAttackDestruction > 0 && (
          <span className="text-xs text-slate-400">
            {member.bestAttackDestruction}%
          </span>
        )}
      </div>
    </div>
  );
}

function WarSizeSelector({ onStartWar }: { onStartWar: (size: number) => void }) {
  const sizes = getWarSizes();
  const [selectedSize, setSelectedSize] = useState<number>(sizes[0] ?? 5);

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-sm text-slate-300">
        Select war size and search for an opponent.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400 uppercase tracking-wide">War Size</span>
        <select
          value={selectedSize}
          onChange={(e) => setSelectedSize(Number(e.target.value))}
          className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-amber-500"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}v{s}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => onStartWar(selectedSize)}
        className="px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
      >
        Start War
      </button>
    </div>
  );
}

function Scoreboard({ war }: { war: WarState }) {
  const { playerClan, enemyClan } = war;
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 mx-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
            {playerClan.name}
          </p>
          <p className="text-xl font-bold text-amber-400">{playerClan.totalStars}</p>
          <p className="text-xs text-slate-500">
            {playerClan.totalDestruction.toFixed(1)}% avg
          </p>
        </div>
        <div className="flex items-center justify-center">
          <span className="text-slate-500 font-bold text-lg">VS</span>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
            {enemyClan.name}
          </p>
          <p className="text-xl font-bold text-amber-400">{enemyClan.totalStars}</p>
          <p className="text-xs text-slate-500">
            {enemyClan.totalDestruction.toFixed(1)}% avg
          </p>
        </div>
      </div>
    </div>
  );
}

function PreparationView({ war }: { war: WarState }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="px-4">
        <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-900/30 rounded px-3 py-2">
          <span className="font-semibold">Preparation Day</span>
          <span className="text-xs text-amber-400/60">
            Scouts are active. Plan your attacks.
          </span>
        </div>
      </div>

      <Scoreboard war={war} />

      <div className="px-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          {war.playerClan.name}
        </h4>
        <div className="space-y-1">
          {war.playerClan.members.map((m, i) => (
            <MemberRow key={i} member={m} index={i} />
          ))}
        </div>
      </div>

      <div className="px-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          {war.enemyClan.name}
        </h4>
        <div className="space-y-1">
          {war.enemyClan.members.map((m, i) => (
            <MemberRow key={i} member={m} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BattleView({
  war,
  onAttack,
  onEndWar,
}: {
  war: WarState;
  onAttack: (defenderIndex: number) => void;
  onEndWar: () => void;
}) {
  const playerHasAttacks = war.playerClan.members.some(
    (m) => m.attacksRemaining > 0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4">
        <div className="flex items-center gap-2 text-sm text-red-300 bg-red-900/30 rounded px-3 py-2">
          <span className="font-semibold">Battle Day</span>
          <span className="text-xs text-red-400/60">
            Attack enemy bases to earn stars.
          </span>
        </div>
      </div>

      <Scoreboard war={war} />

      {/* Player clan summary */}
      <div className="px-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Your Clan
        </h4>
        <div className="space-y-1">
          {war.playerClan.members.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-slate-800 rounded px-3 py-1.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-5 text-right">{i + 1}.</span>
                <span className="text-white">{m.name}</span>
                <span className="text-xs text-amber-300 bg-slate-700 rounded px-1.5 py-0.5">
                  TH{m.townHallLevel}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {m.attacksRemaining} atk left
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Enemy targets */}
      <div className="px-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Enemy Bases (tap to attack)
        </h4>
        <div className="space-y-1">
          {war.enemyClan.members.map((m, i) => (
            <button
              key={i}
              onClick={() => onAttack(i)}
              disabled={!playerHasAttacks}
              className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-5 text-right">{i + 1}.</span>
                <span className="text-white">{m.name}</span>
                <span className="text-xs text-amber-300 bg-slate-700 rounded px-1.5 py-0.5">
                  TH{m.townHallLevel}
                </span>
              </div>
              <StarDisplay count={m.bestAttackStars} max={3} />
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-2">
        <button
          onClick={onEndWar}
          className="w-full px-4 py-2 rounded font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
        >
          End War
        </button>
      </div>
    </div>
  );
}

function EndedView({ war, townHallLevel }: { war: WarState; townHallLevel: number }) {
  const playerStars = war.playerClan.totalStars;
  const enemyStars = war.enemyClan.totalStars;

  let result: 'victory' | 'defeat' | 'draw';
  if (playerStars > enemyStars) {
    result = 'victory';
  } else if (playerStars < enemyStars) {
    result = 'defeat';
  } else {
    const playerDest = war.playerClan.totalDestruction;
    const enemyDest = war.enemyClan.totalDestruction;
    if (playerDest > enemyDest) {
      result = 'victory';
    } else if (playerDest < enemyDest) {
      result = 'defeat';
    } else {
      result = 'draw';
    }
  }

  const style = RESULT_STYLES[result];
  const loot = calculateWarLoot(result, townHallLevel);

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 pt-2 text-center">
        <p className={`text-2xl font-bold ${style.color}`}>{style.label}</p>
      </div>

      <Scoreboard war={war} />

      {/* Loot earned */}
      <div className="px-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          War Loot Earned
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800 rounded px-3 py-2 text-center">
            <p className="text-xs text-yellow-400 mb-0.5">Gold</p>
            <p className="text-sm font-bold text-white">{formatNumber(loot.gold)}</p>
          </div>
          <div className="bg-slate-800 rounded px-3 py-2 text-center">
            <p className="text-xs text-purple-400 mb-0.5">Elixir</p>
            <p className="text-sm font-bold text-white">{formatNumber(loot.elixir)}</p>
          </div>
          {loot.darkElixir > 0 && (
            <div className="bg-slate-800 rounded px-3 py-2 text-center">
              <p className="text-xs text-slate-300 mb-0.5">Dark Elixir</p>
              <p className="text-sm font-bold text-white">{formatNumber(loot.darkElixir)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Member breakdown */}
      <div className="px-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          {war.playerClan.name}
        </h4>
        <div className="space-y-1">
          {war.playerClan.members.map((m, i) => (
            <MemberRow key={i} member={m} index={i} />
          ))}
        </div>
      </div>

      <div className="px-4 pb-2">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          {war.enemyClan.name}
        </h4>
        <div className="space-y-1">
          {war.enemyClan.members.map((m, i) => (
            <MemberRow key={i} member={m} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NoClanMessage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <p className="text-sm text-slate-400 text-center">
        Join a clan to participate in Clan Wars.
      </p>
    </div>
  );
}

function WarContent({
  war,
  clanName,
  townHallLevel,
  onStartWar,
  onAttack,
  onEndWar,
}: Omit<ClanWarPanelProps, 'onClose'>) {
  if (!clanName) {
    return <NoClanMessage />;
  }

  if (!war) {
    return <WarSizeSelector onStartWar={onStartWar} />;
  }

  const phaseViews: Record<string, React.ReactNode> = {
    preparation: <PreparationView war={war} />,
    battle: <BattleView war={war} onAttack={onAttack} onEndWar={onEndWar} />,
    ended: <EndedView war={war} townHallLevel={townHallLevel} />,
  };

  return <>{phaseViews[war.phase] ?? null}</>;
}

export function ClanWarPanel({
  war,
  clanName,
  townHallLevel,
  onStartWar,
  onAttack,
  onEndWar,
  onClose,
}: ClanWarPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-amber-400">Clan War</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close clan war"
        >
          x
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-4">
        <WarContent
          war={war}
          clanName={clanName}
          townHallLevel={townHallLevel}
          onStartWar={onStartWar}
          onAttack={onAttack}
          onEndWar={onEndWar}
        />
      </div>
    </div>
  );
}
