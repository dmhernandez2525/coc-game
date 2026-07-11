import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Screen } from '../App.tsx';
import type { VillageState } from '../types/village.ts';
import type { BattleState, BattleResult, BattleBuilding, DeployedTroop, ActiveSpell } from '../types/battle.ts';
import {
  initBattleState, deployTroop, deployHeroToBattle, deployAttackerCC, deploySiegeToBattle,
  tickBattle, getBattleResult, isBattleOver,
} from '../engine/battle-engine.ts';
import { deploySpell } from '../engine/spell-engine.ts';
import {
  spawnBattleFx,
  advanceFx,
  fxProgress,
  type BattleFx,
} from '../engine/battle-fx.ts';
import { isHeroAvailableForBattle } from '../engine/hero-manager.ts';
import { getHeroBattleBoost } from '../engine/equipment-manager.ts';
import { getOwnedPetLevel } from '../engine/pet-manager.ts';
import { getDefensiveGarrisonForTH } from '../engine/cc-troops-manager.ts';
import { isPotionActive, applyPowerPotionToArmy, getHeroPotionLevel } from '../engine/magic-items-manager.ts';
import type { NPCBase } from '../data/npc-bases.ts';
import { getRandomNPCBase, getBaseTrophyOffer } from '../data/npc-bases.ts';
import { createStarterVillage } from '../engine/village-manager.ts';
import { BattleHUD } from './BattleHUD.tsx';
import { BattleResultScreen } from './BattleResultScreen.tsx';

interface BattleScreenProps {
  onNavigate: (screen: Screen) => void;
  externalState?: VillageState;
  onBattleComplete?: (result: BattleResult) => void;
  /** Fixed enemy base (clan war attacks); random matchmaking when absent. */
  enemyBase?: NPCBase;
  /** War attacks pay no trophies or raid loot; war loot arrives via the treasury. */
  warMode?: boolean;
}

const TICK_MS = 50;
const CW = 800;
const CH = 600;
const CELL = 20;

const SPELL_COLORS: Record<string, string> = {
  'Healing Spell': 'rgba(34, 197, 94, 0.25)',
  'Rage Spell': 'rgba(239, 68, 68, 0.25)',
  'Poison Spell': 'rgba(168, 85, 247, 0.25)',
  'Freeze Spell': 'rgba(56, 189, 248, 0.25)',
  'Haste Spell': 'rgba(250, 204, 21, 0.25)',
};

function hpColor(ratio: number): string {
  if (ratio > 0.5) return '#22c55e';
  return ratio > 0.25 ? '#eab308' : '#ef4444';
}

function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = hpColor(ratio);
  ctx.fillRect(x, y, w * ratio, 3);
}

function drawFx(ctx: CanvasRenderingContext2D, fx: BattleFx[]) {
  for (const item of fx) {
    const t = fxProgress(item);
    if (item.kind === 'projectile') {
      // A small tracer that travels from the defence to its target.
      const x = (item.x1 + (item.x2 - item.x1) * t) * CELL + CELL / 2;
      const y = (item.y1 + (item.y2 - item.y1) * t) * CELL + CELL / 2;
      ctx.globalAlpha = 1 - t * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // An expanding, fading ring where a troop fell.
      const x = item.x * CELL + CELL / 2;
      const y = item.y * CELL + CELL / 2;
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(x, y, 3 + t * 8, 0, Math.PI * 2);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawBattleField(
  ctx: CanvasRenderingContext2D, buildings: BattleBuilding[],
  troops: DeployedTroop[], spells: ActiveSpell[], fx: BattleFx[],
) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < CW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
  for (let y = 0; y < CH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }

  // Draw active spell effect circles
  for (const s of spells) {
    const sx = s.x * CELL, sy = s.y * CELL;
    ctx.beginPath();
    ctx.arc(sx, sy, s.radius * CELL, 0, Math.PI * 2);
    ctx.fillStyle = SPELL_COLORS[s.name] ?? 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
  }

  for (const b of buildings) {
    const bx = b.x * CELL, by = b.y * CELL;
    ctx.globalAlpha = b.isDestroyed ? 0.4 : 1;
    ctx.fillStyle = b.isDestroyed ? '#475569' : '#f59e0b';
    ctx.fillRect(bx, by, CELL, CELL);
    ctx.globalAlpha = 1;
    if (!b.isDestroyed && b.maxHp > 0) drawHpBar(ctx, bx, by - 4, CELL, b.currentHp / b.maxHp);
  }
  for (const t of troops) {
    if (t.state === 'dead') continue;
    const tx = t.x * CELL, ty = t.y * CELL;
    const radius = t.isHero ? 8 : 6;
    ctx.beginPath();
    ctx.arc(tx + 6, ty + 6, radius, 0, Math.PI * 2);
    ctx.fillStyle = troopColor(t);
    ctx.fill();
    if (t.maxHp > 0) drawHpBar(ctx, tx - 2, ty - 6, 16, t.currentHp / t.maxHp);
  }

  drawFx(ctx, fx);
}

function troopColor(t: DeployedTroop): string {
  if (t.isDefender) return '#f87171';
  if (t.isHero) return '#fbbf24';
  if (t.isPet) return '#c084fc';
  if (t.isSiegeMachine) return '#fb923c';
  return t.isFlying ? '#38bdf8' : '#4ade80';
}

function clearTimer(ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (ref.current) { clearInterval(ref.current); ref.current = null; }
}

export function BattleScreen({ onNavigate, externalState, onBattleComplete, enemyBase, warMode }: BattleScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Battle with the player's actual army/spells when provided by the host app
  const villageState = useMemo(() => externalState ?? createStarterVillage(), [externalState]);

  // Pick an enemy base and build the initial battle state once per village state.
  // Unlocked heroes join the deploy bar with their equipment boosts and
  // assigned pets, and the base's loot becomes raidable.
  const battleSetup = useMemo(() => {
    const npcBase = enemyBase ?? getRandomNPCBase(villageState.townHallLevel);
    if (!npcBase) return null;
    const equipmentLevels = Object.fromEntries(
      (villageState.ownedEquipment ?? []).map((e) => [e.name, e.level]),
    );
    const ownedPets = villageState.ownedPets ?? [];
    // Hero Potion raises heroes to max level for the battle
    const heroPotionActive = isPotionActive(villageState, 'hero_potion');
    const attackerHeroes = villageState.heroes
      .filter(isHeroAvailableForBattle)
      .map((h) => ({
        name: h.name,
        level: heroPotionActive ? getHeroPotionLevel(h.name, h.level) : h.level,
        boost: getHeroBattleBoost(h, equipmentLevels),
        ...(h.assignedPet
          ? { pet: { name: h.assignedPet, level: getOwnedPetLevel(ownedPets, h.assignedPet) } }
          : {}),
      }));
    // Power Potion raises army troops to max level for the battle
    const battleArmy = isPotionActive(villageState, 'power_potion')
      ? applyPowerPotionToArmy(villageState.army)
      : villageState.army;
    // Clan castle troops and one trained siege machine ride along on attacks
    const attackerCastleTroops = villageState.clan?.castleTroops ?? [];
    const trainedSiege = (villageState.siegeMachines ?? []).find((s) => s.count > 0);
    const initial = initBattleState(npcBase, battleArmy, villageState.spells, {
      attackerHeroes,
      availableLoot: warMode ? { gold: 0, elixir: 0, darkElixir: 0 } : npcBase.loot,
      defenderCastleTroops: getDefensiveGarrisonForTH(npcBase.townHallLevel),
      ...(attackerCastleTroops.length > 0 ? { attackerCastleTroops } : {}),
      ...(trainedSiege ? { attackerSiege: { name: trainedSiege.name, level: trainedSiege.level } } : {}),
    });
    // Multiplayer raids pay trophies scaled by the TH matchup; war attacks pay none
    const trophyOffer = warMode ? 0 : getBaseTrophyOffer(npcBase, villageState.townHallLevel);
    return { trophyOffer, initial };
  }, [villageState, enemyBase, warMode]);

  const npcBaseFound = battleSetup !== null;
  const trophyOffer = battleSetup?.trophyOffer ?? 0;
  const [tickedState, setTickedState] = useState<BattleState | null>(null);
  const battleState = tickedState ?? battleSetup?.initial ?? null;
  const [result, setResult] = useState<BattleResult | null>(null);
  const [selectedTroop, setSelectedTroop] = useState<string | null>(
    () => battleSetup?.initial.availableTroops.find((t) => t.count > 0)?.name ?? null,
  );
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null);
  const [selectedHero, setSelectedHero] = useState<string | null>(null);
  const [selectedReinforcement, setSelectedReinforcement] = useState<'cc' | 'siege' | null>(null);
  const stateRef = useRef<BattleState | null>(null);
  useEffect(() => { stateRef.current = battleState; }, [battleState]);

  // Transient visual effects (projectiles, death puffs) live outside React state
  // so they can be advanced every tick without re-rendering the whole tree. The
  // seq ref hands out deterministic ids.
  const fxRef = useRef<BattleFx[]>([]);
  const fxSeqRef = useRef(0);

  useEffect(() => {
    if (!battleState || result) return;
    intervalRef.current = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || cur.phase === 'ended') return;
      const next = tickBattle(cur, TICK_MS);
      // Advance existing effects and spawn new ones from the tick's transition.
      const advanced = advanceFx(fxRef.current, TICK_MS);
      const spawned = spawnBattleFx(
        { defenses: cur.defenses, troops: cur.deployedTroops },
        { defenses: next.defenses, troops: next.deployedTroops },
        fxSeqRef.current,
      );
      fxSeqRef.current += spawned.length;
      fxRef.current = spawned.length > 0 ? [...advanced, ...spawned] : advanced;
      setTickedState(next);
      if (isBattleOver(next)) {
        setResult(getBattleResult(next, trophyOffer));
        clearTimer(intervalRef);
      }
    }, TICK_MS);
    return () => clearTimer(intervalRef);
  }, [battleState !== null, result, trophyOffer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!battleState) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawBattleField(ctx, battleState.buildings, battleState.deployedTroops, battleState.spells, fxRef.current);
  }, [battleState]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!battleState || battleState.phase === 'ended') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) * (CW / rect.width)) / CELL);
    const gy = Math.floor(((e.clientY - rect.top) * (CH / rect.height)) / CELL);

    // Deploy hero if one is selected (one deploy per hero per battle)
    if (selectedHero) {
      const next = deployHeroToBattle(battleState, selectedHero, gx, gy);
      if (!next) return;
      setTickedState(next);
      setSelectedHero(null);
      return;
    }

    // Deploy clan castle troops or the siege machine (one deploy each per battle)
    if (selectedReinforcement) {
      const next = selectedReinforcement === 'cc'
        ? deployAttackerCC(battleState, gx, gy)
        : deploySiegeToBattle(battleState, gx, gy);
      if (!next) return;
      setTickedState(next);
      setSelectedReinforcement(null);
      return;
    }

    // Deploy spell if one is selected
    if (selectedSpell) {
      const next = deploySpell(battleState, selectedSpell, gx, gy);
      if (!next) return;
      setTickedState(next);
      const rem = next.availableSpells.find((s) => s.name === selectedSpell);
      if (!rem || rem.count <= 0) setSelectedSpell(null);
      return;
    }

    // Deploy troop
    if (!selectedTroop) return;
    const next = deployTroop(battleState, selectedTroop, gx, gy);
    if (!next) return;
    setTickedState(next);
    const rem = next.availableTroops.find((t) => t.name === selectedTroop);
    if (!rem || rem.count <= 0) {
      setSelectedTroop(next.availableTroops.find((t) => t.count > 0)?.name ?? null);
    }
  }, [battleState, selectedTroop, selectedSpell, selectedHero, selectedReinforcement]);

  const handleSelectTroop = useCallback((name: string) => {
    setSelectedSpell(null);
    setSelectedHero(null);
    setSelectedReinforcement(null);
    setSelectedTroop((prev) => (prev === name ? null : name));
  }, []);

  const handleSelectSpell = useCallback((name: string) => {
    setSelectedTroop(null);
    setSelectedHero(null);
    setSelectedReinforcement(null);
    setSelectedSpell((prev) => (prev === name ? null : name));
  }, []);

  const handleSelectHero = useCallback((name: string) => {
    setSelectedTroop(null);
    setSelectedSpell(null);
    setSelectedReinforcement(null);
    setSelectedHero((prev) => (prev === name ? null : name));
  }, []);

  const handleSelectReinforcement = useCallback((kind: 'cc' | 'siege') => {
    setSelectedTroop(null);
    setSelectedSpell(null);
    setSelectedHero(null);
    setSelectedReinforcement((prev) => (prev === kind ? null : kind));
  }, []);

  const handleSurrender = useCallback(() => {
    if (!battleState) return;
    const ended: BattleState = { ...battleState, phase: 'ended', timeRemaining: 0 };
    setTickedState(ended);
    setResult(getBattleResult(ended, trophyOffer));
    clearTimer(intervalRef);
  }, [battleState, trophyOffer]);

  const handleReturnHome = useCallback(() => {
    if (result && onBattleComplete) onBattleComplete(result);
    onNavigate('village');
  }, [result, onBattleComplete, onNavigate]);

  if (!npcBaseFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h2 className="text-2xl font-bold text-red-400">No bases available</h2>
        <p className="text-slate-400">No enemy bases found for Town Hall level {villageState.townHallLevel}.</p>
        <button onClick={() => onNavigate('village')} className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold transition-colors">
          Return to Village
        </button>
      </div>
    );
  }
  if (!battleState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-lg text-slate-400">Preparing battle...</span>
      </div>
    );
  }
  const availableHeroes = battleState.availableHeroes ?? [];
  const attackerCC = battleState.attackerCC ?? null;
  const attackerSiege = battleState.attackerSiege ?? null;
  const showSupportBar = availableHeroes.length > 0 || attackerCC !== null || attackerSiege !== null;
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-slate-950">
      <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick}
        className="border border-slate-700 rounded-lg cursor-crosshair max-w-full max-h-[80vh]"
        style={{ imageRendering: 'pixelated' }} />
      {!result && (
        <BattleHUD state={battleState} selectedTroop={selectedTroop} selectedSpell={selectedSpell}
          onDeployTroop={handleSelectTroop} onDeploySpell={handleSelectSpell} onSurrender={handleSurrender} />
      )}
      {!result && showSupportBar && (
        <div className="absolute bottom-[76px] left-0 right-0 z-10 flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-t border-slate-700 overflow-x-auto">
          {availableHeroes.length > 0 && (
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold shrink-0">Heroes</span>
          )}
          {availableHeroes.map((hero) => (
            <button
              key={hero.name}
              onClick={() => handleSelectHero(hero.name)}
              disabled={hero.deployed}
              className={`flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[88px] transition-colors ${
                selectedHero === hero.name
                  ? 'bg-amber-500 text-slate-900'
                  : hero.deployed
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-800 hover:bg-amber-700 text-amber-100'
              }`}
            >
              <span className="text-xs font-semibold truncate max-w-[80px]">{hero.name}</span>
              <span className="text-[10px] tabular-nums mt-0.5">
                {hero.deployed ? 'Deployed' : `Lv ${hero.level}`}
              </span>
            </button>
          ))}
          {(attackerCC || attackerSiege) && (
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold shrink-0">Support</span>
          )}
          {attackerCC && (
            <button
              onClick={() => handleSelectReinforcement('cc')}
              disabled={attackerCC.deployed}
              className={`flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[88px] transition-colors ${
                selectedReinforcement === 'cc'
                  ? 'bg-purple-500 text-slate-900'
                  : attackerCC.deployed
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-800 hover:bg-purple-700 text-purple-100'
              }`}
            >
              <span className="text-xs font-semibold truncate max-w-[80px]">Clan Castle</span>
              <span className="text-[10px] tabular-nums mt-0.5">
                {attackerCC.deployed ? 'Deployed' : `${attackerCC.troops.reduce((sum, t) => sum + t.count, 0)} troops`}
              </span>
            </button>
          )}
          {attackerSiege && (
            <button
              onClick={() => handleSelectReinforcement('siege')}
              disabled={attackerSiege.deployed}
              className={`flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[88px] transition-colors ${
                selectedReinforcement === 'siege'
                  ? 'bg-orange-500 text-slate-900'
                  : attackerSiege.deployed
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-orange-800 hover:bg-orange-700 text-orange-100'
              }`}
            >
              <span className="text-xs font-semibold truncate max-w-[80px]">{attackerSiege.name}</span>
              <span className="text-[10px] tabular-nums mt-0.5">
                {attackerSiege.deployed ? 'Deployed' : `Lv ${attackerSiege.level}`}
              </span>
            </button>
          )}
        </div>
      )}
      {result && <BattleResultScreen result={result} onReturnHome={handleReturnHome} />}
    </div>
  );
}
