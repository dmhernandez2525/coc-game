// Transient visual effects for the battle canvas: defense projectiles and troop
// death puffs. This module owns only the DATA and the delta-timed lifecycle so
// it can be unit tested with no canvas and no real timers. The renderer reads
// the fx list each frame and draws cheap shapes; battle simulation is untouched.

import type { ActiveDefense, DeployedTroop } from '../types/battle.ts';

/** How long a projectile takes to travel from muzzle to target. */
export const PROJECTILE_DURATION_MS = 220;
/** How long a death puff lingers before fading out. */
export const DEATH_DURATION_MS = 360;

export interface Projectile {
  id: string;
  kind: 'projectile';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  elapsed: number;
  duration: number;
  color: string;
}

export interface DeathPuff {
  id: string;
  kind: 'death';
  x: number;
  y: number;
  elapsed: number;
  duration: number;
  color: string;
}

export type BattleFx = Projectile | DeathPuff;

// Projectile tint by defense family. Anything unlisted uses the fallback.
const DEFENSE_PROJECTILE_COLORS: Record<string, string> = {
  Cannon: '#fbbf24',
  'Archer Tower': '#fef08a',
  Mortar: '#f97316',
  'Wizard Tower': '#a855f7',
  'Air Defense': '#38bdf8',
  'Hidden Tesla': '#67e8f9',
  'X-Bow': '#f472b6',
  'Inferno Tower': '#ef4444',
  'Eagle Artillery': '#f87171',
  'Bomb Tower': '#fb7185',
  Scattershot: '#facc15',
};
const DEFAULT_PROJECTILE_COLOR = '#fde68a';

/** Projectile colour for a defence by name. */
export function projectileColorFor(name: string): string {
  return DEFENSE_PROJECTILE_COLORS[name] ?? DEFAULT_PROJECTILE_COLOR;
}

/** Linear travel/fade progress in the range [0, 1]. */
export function fxProgress(fx: BattleFx): number {
  if (fx.duration <= 0) return 1;
  const ratio = fx.elapsed / fx.duration;
  return ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
}

export function createProjectile(
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
): Projectile {
  return {
    id,
    kind: 'projectile',
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    elapsed: 0,
    duration: PROJECTILE_DURATION_MS,
    color,
  };
}

export function createDeathPuff(
  id: string,
  at: { x: number; y: number },
  color: string,
): DeathPuff {
  return {
    id,
    kind: 'death',
    x: at.x,
    y: at.y,
    elapsed: 0,
    duration: DEATH_DURATION_MS,
    color,
  };
}

/**
 * Defences that fired between the previous and next tick: their lastAttackTime
 * advanced, they are alive, and they still hold a target. These become
 * projectiles aimed at the target's current position.
 */
export function diffDefenseFires(
  prev: ActiveDefense[],
  next: ActiveDefense[],
): ActiveDefense[] {
  const prevById = new Map(prev.map((d) => [d.buildingInstanceId, d]));
  return next.filter((d) => {
    if (d.isDestroyed || d.targetTroopId === null) return false;
    const before = prevById.get(d.buildingInstanceId);
    if (!before) return false;
    return d.lastAttackTime > before.lastAttackTime;
  });
}

/** Troops that transitioned into the 'dead' state on this tick. */
export function diffTroopDeaths(
  prev: DeployedTroop[],
  next: DeployedTroop[],
): DeployedTroop[] {
  const prevById = new Map(prev.map((t) => [t.id, t]));
  return next.filter((t) => {
    const before = prevById.get(t.id);
    return t.state === 'dead' && before !== undefined && before.state !== 'dead';
  });
}

/**
 * Build the new fx spawned this tick from the defence/troop diffs. Targets are
 * looked up in `nextTroops` so projectiles point at where the victim is now.
 * `seq` seeds deterministic ids so callers (and tests) stay reproducible.
 */
export function spawnBattleFx(
  prev: { defenses: ActiveDefense[]; troops: DeployedTroop[] },
  next: { defenses: ActiveDefense[]; troops: DeployedTroop[] },
  seq: number,
): BattleFx[] {
  const troopById = new Map(next.troops.map((t) => [t.id, t]));
  const fx: BattleFx[] = [];
  let n = seq;

  for (const defense of diffDefenseFires(prev.defenses, next.defenses)) {
    const target = defense.targetTroopId ? troopById.get(defense.targetTroopId) : undefined;
    if (!target) continue;
    n += 1;
    fx.push(
      createProjectile(
        `proj_${String(n)}`,
        { x: defense.x, y: defense.y },
        { x: target.x, y: target.y },
        projectileColorFor(defense.name),
      ),
    );
  }

  for (const dead of diffTroopDeaths(prev.troops, next.troops)) {
    n += 1;
    fx.push(createDeathPuff(`death_${String(n)}`, { x: dead.x, y: dead.y }, '#e2e8f0'));
  }

  return fx;
}

/**
 * Advance every effect by the elapsed time and drop the finished ones. Returns
 * the same reference when the list is empty so callers can skip re-renders.
 */
export function advanceFx(fx: BattleFx[], deltaMs: number): BattleFx[] {
  if (fx.length === 0) return fx;
  const advanced: BattleFx[] = [];
  for (const item of fx) {
    const elapsed = item.elapsed + deltaMs;
    if (elapsed < item.duration) advanced.push({ ...item, elapsed });
  }
  return advanced;
}
