import type { ActiveDefense, DeployedTroop } from '../types/battle.ts';
import { distance, findDefenseTarget, canDefenseTarget } from './targeting-ai.ts';

// --- Inferno Tower (Single Target) ---
// Damage ramps over 2 seconds from base DPS to 5x. Negates healing on target.

const INFERNO_SINGLE_RAMP_MAX = 5;
const INFERNO_SINGLE_RAMP_DURATION = 2; // seconds to reach max

function processInfernoSingle(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number, deltaMs: number,
): void {
  if (defense.isDestroyed || defense.isFrozen) return;

  retargetIfDead(defense, troops);
  if (!defense.targetTroopId) defense.targetTroopId = findDefenseTarget(defense, troops);
  if (!defense.targetTroopId) { defense.infernoRampTime = 0; return; }

  const target = troops.find((t) => t.id === defense.targetTroopId);
  if (!target || target.state === 'dead') { defense.infernoRampTime = 0; return; }

  // Drop locked targets that have left the tower's range
  if (!isInRange(defense, target)) {
    defense.targetTroopId = null;
    defense.infernoRampTime = 0;
    return;
  }

  // Ramp damage
  defense.infernoRampTime = (defense.infernoRampTime ?? 0) + deltaMs / 1000;
  const rampFraction = Math.min(defense.infernoRampTime / INFERNO_SINGLE_RAMP_DURATION, 1);
  const rampMultiplier = 1 + (INFERNO_SINGLE_RAMP_MAX - 1) * rampFraction;
  const damage = defense.baseDps * rampMultiplier * (deltaMs / 1000);

  target.currentHp = Math.max(0, target.currentHp - damage);
  target.healingNerfed = true; // Negates healing while Inferno is locked on
  if (target.currentHp <= 0) {
    target.state = 'dead';
    target.currentHp = 0;
    defense.targetTroopId = null;
    defense.infernoRampTime = 0;
  }
  defense.lastAttackTime = elapsed;
}

// --- Inferno Tower (Multi Target) ---
// Hits up to 5 targets simultaneously at base DPS each.

function processInfernoMulti(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number, deltaMs: number,
): void {
  if (defense.isDestroyed || defense.isFrozen) return;

  const maxTargets = defense.infernoMaxTargets ?? 5;
  const targets = troops
    .filter((t) => t.state !== 'dead' && isInRange(defense, t))
    .sort((a, b) => distance(defense.x, defense.y, a.x, a.y) - distance(defense.x, defense.y, b.x, b.y))
    .slice(0, maxTargets);

  for (const target of targets) {
    const damage = defense.baseDps * (deltaMs / 1000);
    target.currentHp = Math.max(0, target.currentHp - damage);
    if (target.currentHp <= 0) { target.state = 'dead'; target.currentHp = 0; }
  }
  defense.lastAttackTime = elapsed;
}

// --- Hidden Tesla ---
// Invisible until attacker within range OR destruction >= 51%.

function processHiddenTesla(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number,
  destructionPercent: number,
): void {
  if (defense.isDestroyed || defense.isFrozen) return;

  // Reveal check
  if (defense.isHidden) {
    const revealRange = defense.revealTriggerRange ?? 6;
    const nearbyTroop = troops.some(
      (t) => t.state !== 'dead' && distance(defense.x, defense.y, t.x, t.y) <= revealRange,
    );
    if (nearbyTroop || destructionPercent >= 51) {
      defense.isHidden = false;
    } else {
      return; // Stay hidden, do nothing
    }
  }

  // Standard defense behavior after reveal
  processStandardDefense(defense, troops, elapsed);
}

// --- Eagle Artillery ---
// Activates after 200+ troop housing deployed. Has min range of 7 tiles.
// Fires salvos dealing splash damage.

function processEagleArtillery(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number,
  totalHousingDeployed: number,
): void {
  if (defense.isDestroyed || defense.isFrozen) return;

  const threshold = defense.eagleActivationThreshold ?? 200;
  if (!defense.eagleActivated && totalHousingDeployed >= threshold) {
    defense.eagleActivated = true;
  }
  if (!defense.eagleActivated) return;

  // Eagle has min range 7, max range 50
  processStandardDefense(defense, troops, elapsed);
}

// --- Mortar ---
// Has a dead zone (min range 4). Fires splash shells.

function processMortar(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number,
): void {
  if (defense.isDestroyed || defense.isFrozen) return;

  retargetIfDead(defense, troops);
  if (!defense.targetTroopId) defense.targetTroopId = findDefenseTarget(defense, troops);
  if (!defense.targetTroopId) return;
  if (elapsed - defense.lastAttackTime < defense.attackSpeed) return;

  const target = troops.find((t) => t.id === defense.targetTroopId);
  if (!target || target.state === 'dead') return;

  // Splash damage to all troops in radius
  const splashRadius = defense.splashRadius ?? 1.5;
  for (const t of troops) {
    if (t.state === 'dead' || t.isFlying) continue;
    if (distance(target.x, target.y, t.x, t.y) <= splashRadius) {
      t.currentHp = Math.max(0, t.currentHp - defense.dps * defense.attackSpeed);
      if (t.currentHp <= 0) { t.state = 'dead'; t.currentHp = 0; }
    }
  }
  defense.lastAttackTime = elapsed;
}

// --- Air Sweeper ---
// Deals 0 damage but pushes back air troops in a cone.

function processAirSweeper(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number,
): void {
  if (defense.isDestroyed || defense.isFrozen) return;
  if (elapsed - defense.lastAttackTime < defense.attackSpeed) return;

  const pushStrength = defense.pushbackStrength ?? 3; // tiles
  for (const t of troops) {
    if (t.state === 'dead' || !t.isFlying) continue;
    const d = distance(defense.x, defense.y, t.x, t.y);
    if (d > defense.range.max || d < defense.range.min) continue;

    // Push troop away from defense
    if (d > 0) {
      const dx = (t.x - defense.x) / d;
      const dy = (t.y - defense.y) / d;
      t.x += dx * pushStrength;
      t.y += dy * pushStrength;
    }
  }
  defense.lastAttackTime = elapsed;
}

// --- Scattershot ---
// Lobs a bouncing projectile at the nearest target. The impact scatters
// shrapnel behind the target in a 90 degree cone, so troops past the impact
// point take splash damage while troops beside or in front stay unharmed.
// Each shot damages only one domain (ground OR air), matching the target.

const SCATTER_CONE_HALF_ANGLE_COS = Math.cos(Math.PI / 4); // 90 degree arc

/** True when a troop sits inside the shrapnel cone behind the impact point. */
function isInScatterCone(
  defense: ActiveDefense, target: DeployedTroop, troop: DeployedTroop, radius: number,
): boolean {
  const coneX = target.x - defense.x;
  const coneY = target.y - defense.y;
  const coneLen = Math.sqrt(coneX * coneX + coneY * coneY);
  const spreadX = troop.x - target.x;
  const spreadY = troop.y - target.y;
  const spreadLen = Math.sqrt(spreadX * spreadX + spreadY * spreadY);
  if (coneLen === 0 || spreadLen === 0 || spreadLen > radius) return false;

  const cosAngle = (coneX * spreadX + coneY * spreadY) / (coneLen * spreadLen);
  return cosAngle >= SCATTER_CONE_HALF_ANGLE_COS;
}

function processScattershot(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number,
): void {
  if (defense.isDestroyed || defense.isFrozen) return;

  retargetIfDead(defense, troops);
  const targetable = troops.filter((t) => !t.isDefender);
  if (!defense.targetTroopId) defense.targetTroopId = findDefenseTarget(defense, targetable);
  if (!defense.targetTroopId) return;

  const target = troops.find((t) => t.id === defense.targetTroopId);
  if (!target || target.state === 'dead') return;

  if (!isInRange(defense, target)) {
    defense.targetTroopId = null;
    return;
  }
  if (elapsed - defense.lastAttackTime < defense.attackSpeed) return;

  // Primary impact: one attack cycle worth of damage
  const shotDamage = defense.dps * defense.attackSpeed;
  damageTroop(target, shotDamage);

  // Shrapnel bounce: splash behind the impact point, same domain only
  const splashDamage = defense.scatterSplashDamage ?? shotDamage * 0.75;
  const splashRadius = defense.scatterSplashRadius ?? 2.5;
  for (const t of targetable) {
    if (t.state === 'dead' || t.id === target.id) continue;
    if (t.isFlying !== target.isFlying) continue;
    if (!isInScatterCone(defense, target, t, splashRadius)) continue;
    damageTroop(t, splashDamage);
  }

  if (target.currentHp <= 0) defense.targetTroopId = null;
  defense.lastAttackTime = elapsed;
}

// --- Bomb Tower ---
// Standard splash defense. On destruction, explodes for massive area damage.

export function processBombTowerDeath(
  defense: ActiveDefense, troops: DeployedTroop[],
): void {
  const deathDmg = defense.deathDamage ?? 0;
  const deathRadius = defense.deathDamageRadius ?? 3;
  if (deathDmg <= 0) return;

  for (const t of troops) {
    if (t.state === 'dead') continue;
    if (distance(defense.x, defense.y, t.x, t.y) <= deathRadius) {
      t.currentHp = Math.max(0, t.currentHp - deathDmg);
      if (t.currentHp <= 0) { t.state = 'dead'; t.currentHp = 0; }
    }
  }
}

// --- Helpers ---

function damageTroop(troop: DeployedTroop, damage: number): void {
  troop.currentHp = Math.max(0, troop.currentHp - damage);
  if (troop.currentHp <= 0) { troop.state = 'dead'; troop.currentHp = 0; }
}

function isInRange(defense: ActiveDefense, troop: DeployedTroop): boolean {
  const d = distance(defense.x, defense.y, troop.x, troop.y);
  return d >= defense.range.min && d <= defense.range.max;
}

function retargetIfDead(defense: ActiveDefense, troops: DeployedTroop[]): void {
  if (defense.targetTroopId) {
    const target = troops.find((t) => t.id === defense.targetTroopId);
    if (!target || target.state === 'dead') defense.targetTroopId = null;
  }
}

function processStandardDefense(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number,
): void {
  retargetIfDead(defense, troops);
  if (!defense.targetTroopId) defense.targetTroopId = findDefenseTarget(defense, troops);
  if (!defense.targetTroopId) return;

  const target = troops.find((t) => t.id === defense.targetTroopId);
  if (!target || target.state === 'dead') return;

  // Drop locked targets that have left the defense's range
  if (!isInRange(defense, target)) {
    defense.targetTroopId = null;
    return;
  }
  if (elapsed - defense.lastAttackTime < defense.attackSpeed) return;

  // Each shot deals one attack cycle worth of damage (dps * seconds per shot)
  const shotDamage = defense.dps * defense.attackSpeed;

  // Splash damage if applicable
  if (defense.splashRadius && defense.splashRadius > 0) {
    for (const t of troops) {
      if (t.state === 'dead') continue;
      if (!canDefenseTarget(defense, t)) continue;
      if (distance(target.x, target.y, t.x, t.y) <= defense.splashRadius) {
        t.currentHp = Math.max(0, t.currentHp - shotDamage);
        if (t.currentHp <= 0) { t.state = 'dead'; t.currentHp = 0; }
      }
    }
  } else {
    target.currentHp = Math.max(0, target.currentHp - shotDamage);
    if (target.currentHp <= 0) { target.state = 'dead'; target.currentHp = 0; defense.targetTroopId = null; }
  }

  defense.lastAttackTime = elapsed;
}

// --- Defense behavior dispatch ---

type DefenseBehaviorContext = {
  troops: DeployedTroop[];
  elapsed: number;
  deltaMs: number;
  destructionPercent: number;
  totalHousingDeployed: number;
};

type DefenseHandler = (
  defense: ActiveDefense, ctx: DefenseBehaviorContext,
) => void;

const DEFENSE_HANDLERS: Record<string, DefenseHandler> = {
  'Inferno Tower': (d, ctx) => {
    if (d.infernoMode === 'multi') {
      processInfernoMulti(d, ctx.troops, ctx.elapsed, ctx.deltaMs);
    } else {
      processInfernoSingle(d, ctx.troops, ctx.elapsed, ctx.deltaMs);
    }
  },
  'Hidden Tesla': (d, ctx) => processHiddenTesla(d, ctx.troops, ctx.elapsed, ctx.destructionPercent),
  'Eagle Artillery': (d, ctx) => processEagleArtillery(d, ctx.troops, ctx.elapsed, ctx.totalHousingDeployed),
  'Mortar': (d, ctx) => processMortar(d, ctx.troops, ctx.elapsed),
  'Air Sweeper': (d, ctx) => processAirSweeper(d, ctx.troops, ctx.elapsed),
  'Scattershot': (d, ctx) => processScattershot(d, ctx.troops, ctx.elapsed),
};

/**
 * Process a defense with its special behavior, or fall back to standard behavior.
 * Returns true if a special handler was used, false for standard processing.
 */
export function processDefenseSpecial(
  defense: ActiveDefense, ctx: DefenseBehaviorContext,
): boolean {
  // Check frozen status
  if (defense.isFrozen && defense.frozenUntil !== undefined) {
    if (ctx.elapsed >= defense.frozenUntil) {
      defense.isFrozen = false;
      defense.frozenUntil = undefined;
    } else {
      return true; // Frozen, skip processing
    }
  }

  const handler = DEFENSE_HANDLERS[defense.name];
  if (handler) {
    // Burrowed/invisible troops are untargetable by special defenses too
    handler(defense, { ...ctx, troops: ctx.troops.filter((t) => !t.isBurrowed) });
    return true;
  }
  return false;
}
