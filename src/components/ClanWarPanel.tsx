import { useState } from 'react';
import type { WarState, WarResult, WarClanMember } from '../engine/clan-war-manager.ts';
import { getWarSizes, calculateWarLoot, getWarBaseDefenseRating } from '../engine/clan-war-manager.ts';
import type { WarLeagueState } from '../engine/war-league-manager.ts';
import { getWarLeagueTierName, PROMOTION_THRESHOLD } from '../engine/war-league-manager.ts';
import type { NPCBase } from '../data/npc-bases.ts';
import { getNPCBaseById } from '../data/npc-bases.ts';

interface ClanWarPanelProps {
  war: WarState | null;
  clanName: string | null;
  townHallLevel: number;
  warLeague: WarLeagueState;
  availableWarBases: NPCBase[];
  onStartWar: (warSize: number) => void;
  onStartBattle?: () => void;
  onSelectWarBase: (baseId: string) => void;
  onAttack: (defenderIndex: number) => void;
  onEndWar: () => void;
  onStartNewWar: () => void;
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

function WarLeagueBadge({ warLeague }: { warLeague: WarLeagueState }) {
  return (
    <div className="mx-4 flex items-center justify-between bg-slate-800/60 rounded px-3 py-2">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide">War League</p>
        <p className="text-sm font-semibold text-sky-300">{getWarLeagueTierName(warLeague)}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Promotion</p>
        <p className="text-sm font-semibold text-white">
          {warLeague.promotionPoints}/{PROMOTION_THRESHOLD}
        </p>
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

function WarBaseSelector({
  war,
  availableWarBases,
  onSelectWarBase,
}: {
  war: WarState;
  availableWarBases: NPCBase[];
  onSelectWarBase: (baseId: string) => void;
}) {
  const selected = war.playerWarBaseId ? getNPCBaseById(war.playerWarBaseId) : undefined;

  return (
    <div className="px-4">
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
        War Base
      </h4>
      <select
        value={war.playerWarBaseId ?? ''}
        onChange={(e) => onSelectWarBase(e.target.value)}
        className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white text-sm focus:outline-none focus:border-amber-500"
      >
        <option value="" disabled>
          Choose a defensive layout
        </option>
        {availableWarBases.map((base) => (
          <option key={base.id} value={base.id}>
            {base.name} (TH{base.townHallLevel})
          </option>
        ))}
      </select>
      {selected ? (
        <p className="text-xs text-slate-400 mt-1">
          Defense rating {Math.round(getWarBaseDefenseRating(selected) * 100)}%.
          A stronger layout concedes fewer stars on battle day.
        </p>
      ) : (
        <p className="text-xs text-amber-400/80 mt-1">
          No war base selected. Pick a layout before battle day.
        </p>
      )}
    </div>
  );
}

function PreparationView({
  war,
  availableWarBases,
  onSelectWarBase,
  onStartBattle,
}: {
  war: WarState;
  availableWarBases: NPCBase[];
  onSelectWarBase: (baseId: string) => void;
  onStartBattle?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="px-4">
        <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-900/30 rounded px-3 py-2">
          <span className="font-semibold">Preparation Day</span>
          <span className="text-xs text-amber-400/60">
            Scouts are active. Pick your war base and plan your attacks.
          </span>
        </div>
      </div>

      <WarBaseSelector
        war={war}
        availableWarBases={availableWarBases}
        onSelectWarBase={onSelectWarBase}
      />

      {onStartBattle && (
        <div className="px-4">
          <button
            onClick={onStartBattle}
            className="w-full px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            Start Battle Day
          </button>
        </div>
      )}

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

function EnemyTargetButton({
  member,
  index,
  disabled,
  onAttack,
}: {
  member: WarClanMember;
  index: number;
  disabled: boolean;
  onAttack: (defenderIndex: number) => void;
}) {
  const baseName = member.warBaseId ? getNPCBaseById(member.warBaseId)?.name : undefined;

  return (
    <button
      onClick={() => onAttack(index)}
      disabled={disabled}
      className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-slate-500 w-5 text-right shrink-0">{index + 1}.</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white truncate">{member.name}</span>
            <span className="text-xs text-amber-300 bg-slate-700 rounded px-1.5 py-0.5 shrink-0">
              TH{member.townHallLevel}
            </span>
          </div>
          {baseName && (
            <p className="text-[10px] text-slate-500 truncate">{baseName}</p>
          )}
        </div>
      </div>
      <StarDisplay count={member.bestAttackStars} max={3} />
    </button>
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
  const attacksLeft = war.playerClan.members.reduce(
    (sum, m) => sum + m.attacksRemaining, 0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4">
        <div className="flex items-center gap-2 text-sm text-red-300 bg-red-900/30 rounded px-3 py-2">
          <span className="font-semibold">Battle Day</span>
          <span className="text-xs text-red-400/60">
            Tap an enemy base to launch a real attack. {attacksLeft} attacks left.
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
            <EnemyTargetButton
              key={i}
              member={m}
              index={i}
              disabled={attacksLeft <= 0}
              onAttack={onAttack}
            />
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

/** Fallback for wars ended before the result was persisted on the state. */
function deriveWarResult(war: WarState): WarResult {
  const starDiff = war.playerClan.totalStars - war.enemyClan.totalStars;
  if (starDiff !== 0) return starDiff > 0 ? 'victory' : 'defeat';
  const destDiff = war.playerClan.totalDestruction - war.enemyClan.totalDestruction;
  if (destDiff !== 0) return destDiff > 0 ? 'victory' : 'defeat';
  return 'draw';
}

function EndedView({
  war,
  townHallLevel,
  onStartNewWar,
}: {
  war: WarState;
  townHallLevel: number;
  onStartNewWar: () => void;
}) {
  const result = war.result ?? deriveWarResult(war);
  const style = RESULT_STYLES[result];
  const loot = war.lootAwarded ?? calculateWarLoot(result, townHallLevel);

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 pt-2 text-center">
        <p className={`text-2xl font-bold ${style.color}`}>{style.label}</p>
      </div>

      <Scoreboard war={war} />

      {/* Loot earned */}
      <div className="px-4">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          War Loot (sent to Treasury)
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

      <div className="px-4">
        <button
          onClick={onStartNewWar}
          className="w-full px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
        >
          Start New War
        </button>
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
  availableWarBases,
  onStartWar,
  onStartBattle,
  onSelectWarBase,
  onAttack,
  onEndWar,
  onStartNewWar,
}: Omit<ClanWarPanelProps, 'onClose' | 'warLeague'>) {
  if (!clanName) {
    return <NoClanMessage />;
  }

  if (!war) {
    return <WarSizeSelector onStartWar={onStartWar} />;
  }

  const phaseViews: Record<string, React.ReactNode> = {
    preparation: (
      <PreparationView
        war={war}
        availableWarBases={availableWarBases}
        onSelectWarBase={onSelectWarBase}
        onStartBattle={onStartBattle}
      />
    ),
    battle: <BattleView war={war} onAttack={onAttack} onEndWar={onEndWar} />,
    ended: <EndedView war={war} townHallLevel={townHallLevel} onStartNewWar={onStartNewWar} />,
  };

  return <>{phaseViews[war.phase] ?? null}</>;
}

export function ClanWarPanel({
  war,
  clanName,
  townHallLevel,
  warLeague,
  availableWarBases,
  onStartWar,
  onStartBattle,
  onSelectWarBase,
  onAttack,
  onEndWar,
  onStartNewWar,
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
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
        {clanName && <WarLeagueBadge warLeague={warLeague} />}
        <WarContent
          war={war}
          clanName={clanName}
          townHallLevel={townHallLevel}
          availableWarBases={availableWarBases}
          onStartWar={onStartWar}
          onStartBattle={onStartBattle}
          onSelectWarBase={onSelectWarBase}
          onAttack={onAttack}
          onEndWar={onEndWar}
          onStartNewWar={onStartNewWar}
        />
      </div>
    </div>
  );
}
