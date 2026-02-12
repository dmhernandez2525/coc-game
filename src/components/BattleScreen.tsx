import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Screen } from '../App.tsx';
import type { BattleState, BattleResult, BattleBuilding, DeployedTroop, ActiveSpell } from '../types/battle.ts';
import { initBattleState, deployTroop, tickBattle, getBattleResult, isBattleOver } from '../engine/battle-engine.ts';
import { deploySpell } from '../engine/spell-engine.ts';
import { getRandomNPCBase } from '../data/npc-bases.ts';
import { createStarterVillage } from '../engine/village-manager.ts';
import { BattleHUD } from './BattleHUD.tsx';
import { BattleResultScreen } from './BattleResultScreen.tsx';

interface BattleScreenProps {
  onNavigate: (screen: Screen) => void;
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

function drawBattleField(
  ctx: CanvasRenderingContext2D, buildings: BattleBuilding[],
  troops: DeployedTroop[], spells: ActiveSpell[],
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
    ctx.beginPath();
    ctx.arc(tx + 6, ty + 6, 6, 0, Math.PI * 2);
    ctx.fillStyle = t.isFlying ? '#38bdf8' : '#4ade80';
    ctx.fill();
    if (t.maxHp > 0) drawHpBar(ctx, tx - 2, ty - 6, 16, t.currentHp / t.maxHp);
  }
}

function clearTimer(ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (ref.current) { clearInterval(ref.current); ref.current = null; }
}

export function BattleScreen({ onNavigate }: BattleScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [selectedTroop, setSelectedTroop] = useState<string | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null);
  const [npcBaseFound, setNpcBaseFound] = useState(true);
  const [trophyOffer, setTrophyOffer] = useState(0);
  const stateRef = useRef<BattleState | null>(null);
  stateRef.current = battleState;

  const villageState = useMemo(() => createStarterVillage(), []);

  useEffect(() => {
    const npcBase = getRandomNPCBase(villageState.townHallLevel);
    if (!npcBase) { setNpcBaseFound(false); return; }
    setTrophyOffer(npcBase.trophyOffer);
    const initial = initBattleState(npcBase, villageState.army, villageState.spells);
    setBattleState(initial);
    const first = initial.availableTroops.find((t) => t.count > 0);
    if (first) setSelectedTroop(first.name);
  }, [villageState]);

  useEffect(() => {
    if (!battleState || result) return;
    intervalRef.current = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || cur.phase === 'ended') return;
      const next = tickBattle(cur, TICK_MS);
      setBattleState(next);
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
    if (ctx) drawBattleField(ctx, battleState.buildings, battleState.deployedTroops, battleState.spells);
  }, [battleState]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!battleState || battleState.phase === 'ended') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) * (CW / rect.width)) / CELL);
    const gy = Math.floor(((e.clientY - rect.top) * (CH / rect.height)) / CELL);

    // Deploy spell if one is selected
    if (selectedSpell) {
      const next = deploySpell(battleState, selectedSpell, gx, gy);
      if (!next) return;
      setBattleState(next);
      const rem = next.availableSpells.find((s) => s.name === selectedSpell);
      if (!rem || rem.count <= 0) setSelectedSpell(null);
      return;
    }

    // Deploy troop
    if (!selectedTroop) return;
    const next = deployTroop(battleState, selectedTroop, gx, gy);
    if (!next) return;
    setBattleState(next);
    const rem = next.availableTroops.find((t) => t.name === selectedTroop);
    if (!rem || rem.count <= 0) {
      setSelectedTroop(next.availableTroops.find((t) => t.count > 0)?.name ?? null);
    }
  }, [battleState, selectedTroop, selectedSpell]);

  const handleSelectTroop = useCallback((name: string) => {
    setSelectedSpell(null);
    setSelectedTroop((prev) => (prev === name ? null : name));
  }, []);

  const handleSelectSpell = useCallback((name: string) => {
    setSelectedTroop(null);
    setSelectedSpell((prev) => (prev === name ? null : name));
  }, []);

  const handleSurrender = useCallback(() => {
    if (!battleState) return;
    const ended: BattleState = { ...battleState, phase: 'ended', timeRemaining: 0 };
    setBattleState(ended);
    setResult(getBattleResult(ended, trophyOffer));
    clearTimer(intervalRef);
  }, [battleState, trophyOffer]);

  const handleReturnHome = useCallback(() => {
    onNavigate('village');
  }, [onNavigate]);

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
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-slate-950">
      <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick}
        className="border border-slate-700 rounded-lg cursor-crosshair max-w-full max-h-[80vh]"
        style={{ imageRendering: 'pixelated' }} />
      {!result && (
        <BattleHUD state={battleState} selectedTroop={selectedTroop} selectedSpell={selectedSpell}
          onDeployTroop={handleSelectTroop} onDeploySpell={handleSelectSpell} onSurrender={handleSurrender} />
      )}
      {result && <BattleResultScreen result={result} onReturnHome={handleReturnHome} />}
    </div>
  );
}
