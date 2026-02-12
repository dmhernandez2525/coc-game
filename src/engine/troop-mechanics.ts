import type { DeployedTroop, ActiveDefense, BattleBuilding } from '../types/battle.ts';
import { distance } from './targeting-ai.ts';

// --- Wall Breaker ---
// 40x damage to walls, self-destructs on impact.

function processWallBreaker(
  troop: DeployedTroop, buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): void {
  if (troop.state === 'dead') return;
  // Wall Breakers only attack walls; wallDamageMultiplier should be set to 40
  if (troop.state === 'attacking' && troop.targetId) {
    const targetBuilding = buildings.find((b) => b.instanceId === troop.targetId && !b.isDestroyed);
    if (targetBuilding) {
      const mult = targetBuilding.name === 'Wall' ? (troop.wallDamageMultiplier ?? 40) : 1;
      const damage = troop.dps * mult * (deltaMs / 1000);
      targetBuilding.currentHp = Math.max(0, targetBuilding.currentHp - damage);
      if (targetBuilding.currentHp <= 0) targetBuilding.isDestroyed = true;
    }
    // Self-destruct after dealing damage
    troop.currentHp = 0;
    troop.state = 'dead';
  }
}

// --- Goblin ---
// 2x damage to resource buildings.

function processGoblin(
  troop: DeployedTroop, buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): void {
  if (troop.state !== 'attacking' || !troop.targetId) return;
  const target = buildings.find((b) => b.instanceId === troop.targetId && !b.isDestroyed);
  if (!target) return;

  const isResource = ['Gold Storage', 'Elixir Storage', 'Dark Elixir Storage',
    'Gold Mine', 'Elixir Collector', 'Dark Elixir Drill', 'Town Hall']
    .some((kw) => target.name.includes(kw));
  const mult = isResource ? (troop.resourceDamageMultiplier ?? 2) : 1;
  const damage = troop.dps * mult * (deltaMs / 1000);

  target.currentHp = Math.max(0, target.currentHp - damage);
  if (target.currentHp <= 0) target.isDestroyed = true;

  // Sync to defense if applicable
  syncBuildingToDefense(target, defenses);
}

// --- Healer ---
// Heals nearby ground troops. 50% healing reduction on heroes. Cannot heal other Healers.

function processHealer(
  troop: DeployedTroop, allTroops: DeployedTroop[], deltaMs: number,
): void {
  if (troop.state === 'dead') return;
  const healPerSec = troop.healPerSecond ?? 0;
  const radius = troop.healRadius ?? 5;
  if (healPerSec <= 0) return;

  for (const t of allTroops) {
    if (t.state === 'dead' || t.id === troop.id) continue;
    if (t.name === 'Healer') continue; // Anti-chain: cannot heal other Healers
    if (t.isFlying) continue; // Healers only heal ground troops
    if (t.healingNerfed) continue; // Inferno Tower negates healing
    if (distance(troop.x, troop.y, t.x, t.y) > radius) continue;

    let heal = healPerSec * (deltaMs / 1000);
    if (t.isHero) heal *= 0.5; // 50% reduced healing on heroes
    t.currentHp = Math.min(t.maxHp, t.currentHp + heal);
  }
}

// --- Baby Dragon ---
// Enrage when no other air troops within 4.5 tiles. DPS doubles when enraged.

function checkBabyDragonEnrage(
  troop: DeployedTroop, allTroops: DeployedTroop[],
): void {
  const enrageRadius = 4.5;
  const nearbyAir = allTroops.some(
    (t) => t.id !== troop.id && t.state !== 'dead' && t.isFlying
      && distance(troop.x, troop.y, t.x, t.y) <= enrageRadius,
  );

  if (!nearbyAir && !troop.isEnraged) {
    troop.isEnraged = true;
    troop.dps = troop.baseDps * 2;
  } else if (nearbyAir && troop.isEnraged) {
    troop.isEnraged = false;
    troop.dps = troop.baseDps;
  }
}

// --- Miner ---
// Burrows underground (untargetable) while moving to next target.

function processMiner(
  troop: DeployedTroop,
): void {
  if (troop.state === 'dead') return;
  troop.isBurrowed = troop.state === 'moving';
}

// --- Electro Dragon ---
// Chain lightning: primary target + bounces to nearby targets with damage decay.

function processElectroDragonAttack(
  troop: DeployedTroop, allTroops: DeployedTroop[],
  buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): boolean {
  if (troop.state !== 'attacking' || !troop.targetId) return false;

  const chains = troop.chainTargets ?? 4;
  const decay = troop.chainDamageDecay ?? 0.75;
  const baseDamage = troop.dps * (deltaMs / 1000);

  // Primary target gets full damage (handled by normal processTroop)
  // Chain to nearby buildings/defenses
  const targetPos = findBuildingPos(troop.targetId, buildings, defenses);
  if (!targetPos) return false;

  let chainX = targetPos.x;
  let chainY = targetPos.y;
  let currentDamage = baseDamage * decay;
  const hitIds = new Set([troop.targetId]);

  for (let i = 0; i < chains; i++) {
    // Find nearest unhit building within 4 tiles
    let nearestId: string | null = null;
    let nearestDist = 4;
    let nearestPos = { x: 0, y: 0 };

    for (const b of buildings) {
      if (b.isDestroyed || hitIds.has(b.instanceId)) continue;
      const d = distance(chainX, chainY, b.x, b.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = b.instanceId;
        nearestPos = { x: b.x, y: b.y };
      }
    }

    if (!nearestId) break;
    hitIds.add(nearestId);

    // Apply chain damage
    applyBuildingDamage(nearestId, currentDamage, buildings, defenses);
    chainX = nearestPos.x;
    chainY = nearestPos.y;
    currentDamage *= decay;
  }

  return true;
}

// --- Valkyrie ---
// Attacks in 360-degree arc, hitting all adjacent enemies.

function processValkyrieAttack(
  troop: DeployedTroop, buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): boolean {
  if (troop.state !== 'attacking' || !troop.targetId) return false;

  const splashRadius = troop.splashRadius ?? 1;
  const damage = troop.dps * (deltaMs / 1000);

  // Damage all buildings within splash radius of troop's position
  for (const b of buildings) {
    if (b.isDestroyed) continue;
    if (distance(troop.x, troop.y, b.x, b.y) <= splashRadius) {
      b.currentHp = Math.max(0, b.currentHp - damage);
      if (b.currentHp <= 0) b.isDestroyed = true;
      syncBuildingToDefense(b, defenses);
    }
  }

  return true;
}

// --- Death spawns (Golem -> Golemite, Lava Hound -> Lava Pup) ---

export function processDeathSpawns(
  deadTroop: DeployedTroop,
): DeployedTroop[] {
  const spawns: DeployedTroop[] = [];
  if (!deadTroop.deathSpawnName || !deadTroop.deathSpawnCount) return spawns;

  const spawnHp = Math.floor(deadTroop.maxHp * 0.2);
  const spawnDps = Math.floor(deadTroop.baseDps * 0.3);

  for (let i = 0; i < deadTroop.deathSpawnCount; i++) {
    const offsetX = (Math.random() - 0.5) * 2;
    const offsetY = (Math.random() - 0.5) * 2;
    spawns.push({
      id: `${deadTroop.id}_spawn_${i}`,
      name: deadTroop.deathSpawnName,
      level: deadTroop.level,
      currentHp: spawnHp,
      maxHp: spawnHp,
      x: deadTroop.x + offsetX,
      y: deadTroop.y + offsetY,
      targetId: null,
      state: 'idle',
      dps: spawnDps,
      baseDps: spawnDps,
      attackRange: deadTroop.attackRange,
      movementSpeed: deadTroop.movementSpeed,
      isFlying: deadTroop.isFlying,
    });
  }
  return spawns;
}

// --- Death damage (Balloon bomb drop) ---

export function processDeathDamage(
  deadTroop: DeployedTroop, buildings: BattleBuilding[], defenses: ActiveDefense[],
): void {
  if (!deadTroop.deathDamage || !deadTroop.deathDamageRadius) return;

  for (const b of buildings) {
    if (b.isDestroyed) continue;
    if (distance(deadTroop.x, deadTroop.y, b.x, b.y) <= deadTroop.deathDamageRadius) {
      b.currentHp = Math.max(0, b.currentHp - deadTroop.deathDamage);
      if (b.currentHp <= 0) b.isDestroyed = true;
      syncBuildingToDefense(b, defenses);
    }
  }
}

// --- Helpers ---

function syncBuildingToDefense(building: BattleBuilding, defenses: ActiveDefense[]): void {
  if (!building.isDestroyed) return;
  const def = defenses.find((d) => d.buildingInstanceId === building.instanceId);
  if (def) { def.currentHp = 0; def.isDestroyed = true; }
}

function findBuildingPos(
  id: string, buildings: BattleBuilding[], defenses: ActiveDefense[],
): { x: number; y: number } | null {
  const b = buildings.find((b) => b.instanceId === id);
  if (b) return { x: b.x, y: b.y };
  const d = defenses.find((d) => d.buildingInstanceId === id);
  return d ? { x: d.x, y: d.y } : null;
}

function applyBuildingDamage(
  targetId: string, damage: number, buildings: BattleBuilding[], defenses: ActiveDefense[],
): void {
  for (const b of buildings) {
    if (b.instanceId !== targetId || b.isDestroyed) continue;
    b.currentHp = Math.max(0, b.currentHp - damage);
    if (b.currentHp <= 0) { b.isDestroyed = true; syncBuildingToDefense(b, defenses); }
    break;
  }
}

// --- Troop mechanic dispatch ---

type TroopMechanicHandler = (
  troop: DeployedTroop,
  ctx: {
    allTroops: DeployedTroop[];
    buildings: BattleBuilding[];
    defenses: ActiveDefense[];
    deltaMs: number;
  },
) => boolean; // Returns true if special attack handling was done (skip normal damage)

const TROOP_HANDLERS: Record<string, TroopMechanicHandler> = {
  'Wall Breaker': (troop, ctx) => {
    processWallBreaker(troop, ctx.buildings, ctx.defenses, ctx.deltaMs);
    return true;
  },
  'Goblin': (troop, ctx) => {
    processGoblin(troop, ctx.buildings, ctx.defenses, ctx.deltaMs);
    return troop.state === 'attacking';
  },
  'Healer': (troop, ctx) => {
    processHealer(troop, ctx.allTroops, ctx.deltaMs);
    return true; // Healers don't deal normal damage
  },
  'Baby Dragon': (troop, ctx) => {
    checkBabyDragonEnrage(troop, ctx.allTroops);
    return false; // Normal attack with modified DPS
  },
  'Miner': (troop) => {
    processMiner(troop);
    return false;
  },
  'Electro Dragon': (troop, ctx) => {
    return processElectroDragonAttack(troop, ctx.allTroops, ctx.buildings, ctx.defenses, ctx.deltaMs);
  },
  'Valkyrie': (troop, ctx) => {
    return processValkyrieAttack(troop, ctx.buildings, ctx.defenses, ctx.deltaMs);
  },
};

/**
 * Process special troop mechanics before normal attack handling.
 * Returns true if the special handler already applied damage (skip normal damage in processTroop).
 */
export function processTroopSpecial(
  troop: DeployedTroop,
  allTroops: DeployedTroop[],
  buildings: BattleBuilding[],
  defenses: ActiveDefense[],
  deltaMs: number,
): boolean {
  const handler = TROOP_HANDLERS[troop.name];
  if (!handler) return false;
  return handler(troop, { allTroops, buildings, defenses, deltaMs });
}
