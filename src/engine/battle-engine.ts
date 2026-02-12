import type {
  BattleState, DeployedTroop, ActiveDefense, BattleBuilding, BattleResult,
} from '../types/battle.ts';
import type { PlacedBuilding, TrainedTroop } from '../types/village.ts';
import { getDefense } from '../data/loaders/defense-loader.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { findTroopTarget, findDefenseTarget, moveToward, distance } from './targeting-ai.ts';
import { tickSpells } from './spell-engine.ts';

const BATTLE_DURATION = 180;
const DEFAULT_BUILDING_HP = 500;

/** Initialize a fresh battle state from the defender's village and attacker's army. */
export function initBattleState(
  defender: { buildings: PlacedBuilding[] }, attackerArmy: TrainedTroop[], attackerSpells: TrainedTroop[],
): BattleState {
  const buildings: BattleBuilding[] = [];
  const defenses: ActiveDefense[] = [];

  for (const placed of defender.buildings) {
    const defData = getDefense(placed.buildingId);
    const levelStats = defData?.levels.find((l) => l.level === placed.level);
    const hp = levelStats?.hp ?? DEFAULT_BUILDING_HP;

    buildings.push({
      instanceId: placed.instanceId, name: placed.buildingId,
      currentHp: hp, maxHp: hp, x: placed.gridX, y: placed.gridY,
      isDestroyed: false, weight: placed.buildingId === 'Wall' ? 0 : 1,
    });

    if (placed.buildingType === 'defense' && defData && levelStats) {
      defenses.push({
        buildingInstanceId: placed.instanceId, name: placed.buildingId,
        level: placed.level, currentHp: levelStats.hp, maxHp: levelStats.hp,
        x: placed.gridX, y: placed.gridY, targetTroopId: null,
        dps: (levelStats as { dps: number }).dps,
        range: { ...defData.range }, attackSpeed: defData.attackSpeed,
        lastAttackTime: 0, isDestroyed: false,
      });
    }
  }

  return {
    phase: 'active', timeRemaining: BATTLE_DURATION, destructionPercent: 0, stars: 0,
    deployedTroops: [], defenses, buildings, spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: attackerArmy.map((t) => ({ name: t.name, level: t.level, count: t.count })),
    availableSpells: attackerSpells.map((s) => ({ name: s.name, level: s.level, count: s.count })),
  };
}

/** Deploy a troop from available troops at the given position. Returns null if unavailable. */
export function deployTroop(
  state: BattleState, troopName: string, x: number, y: number,
): BattleState | null {
  const idx = state.availableTroops.findIndex((t) => t.name === troopName && t.count > 0);
  if (idx === -1) return null;
  const available = state.availableTroops[idx];
  if (!available) return null;

  const troopData = getTroop(troopName);
  if (!troopData) return null;
  const levelStats = troopData.levels.find((l) => l.level === available.level);
  if (!levelStats) return null;

  const deployed: DeployedTroop = {
    id: `troop_${troopName}_${Date.now()}`, name: troopName, level: available.level,
    currentHp: levelStats.hp, maxHp: levelStats.hp, x, y,
    targetId: null, state: 'idle', dps: levelStats.dps,
    attackRange: troopData.attackRange, movementSpeed: troopData.movementSpeed,
    isFlying: troopData.isFlying,
  };

  const updatedAvailable = state.availableTroops
    .map((t, i) => (i === idx ? { ...t, count: t.count - 1 } : t))
    .filter((t) => t.count > 0);

  return { ...state, deployedTroops: [...state.deployedTroops, deployed], availableTroops: updatedAvailable };
}

/** Find a target's position among buildings and defenses. Returns null if destroyed or missing. */
function findTargetPos(
  targetId: string, buildings: BattleBuilding[], defenses: ActiveDefense[],
): { x: number; y: number } | null {
  const b = buildings.find((b) => b.instanceId === targetId && !b.isDestroyed);
  if (b) return { x: b.x, y: b.y };
  const d = defenses.find((d) => d.buildingInstanceId === targetId && !d.isDestroyed);
  return d ? { x: d.x, y: d.y } : null;
}

/** Apply damage to a building or defense by instance id. Mutates arrays in place within a tick. */
function applyDamage(
  targetId: string, damage: number, buildings: BattleBuilding[], defenses: ActiveDefense[],
): void {
  for (const b of buildings) {
    if (b.instanceId !== targetId || b.isDestroyed) continue;
    b.currentHp = Math.max(0, b.currentHp - damage);
    if (b.currentHp <= 0) b.isDestroyed = true;
    break;
  }
  for (const d of defenses) {
    if (d.buildingInstanceId !== targetId || d.isDestroyed) continue;
    d.currentHp = Math.max(0, d.currentHp - damage);
    if (d.currentHp <= 0) {
      d.isDestroyed = true;
      const match = buildings.find((b) => b.instanceId === targetId);
      if (match) { match.currentHp = 0; match.isDestroyed = true; }
    }
    break;
  }
}

/** Calculate stars and destruction percentage from building state. */
export function calculateStars(
  buildings: BattleBuilding[],
): { stars: number; destructionPercent: number } {
  let totalWeight = 0;
  let destroyedWeight = 0;
  let thDestroyed = false;

  for (const b of buildings) {
    totalWeight += b.weight;
    if (b.isDestroyed) destroyedWeight += b.weight;
    if (b.name === 'Town Hall' && b.isDestroyed) thDestroyed = true;
  }

  const pct = totalWeight > 0 ? (destroyedWeight / totalWeight) * 100 : 0;
  let stars = 0;
  if (pct >= 50) stars += 1;
  if (thDestroyed) stars += 1;
  if (pct >= 100) stars += 1;
  return { stars, destructionPercent: pct };
}

/** Process one troop for the current tick. Mutates troop, buildings, and defenses. */
function processTroop(
  troop: DeployedTroop, buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): void {
  if (troop.state === 'dead') return;

  // Clear dead target.
  if (troop.targetId && !findTargetPos(troop.targetId, buildings, defenses)) {
    troop.targetId = null;
    troop.state = 'idle';
  }

  // Acquire target.
  if (!troop.targetId) {
    const troopData = getTroop(troop.name);
    troop.targetId = findTroopTarget(troop, buildings, defenses, troopData?.favoriteTarget ?? null);
    if (!troop.targetId) return;
  }

  const targetPos = findTargetPos(troop.targetId, buildings, defenses);
  if (!targetPos) { troop.targetId = null; troop.state = 'idle'; return; }

  const dist = distance(troop.x, troop.y, targetPos.x, targetPos.y);
  if (dist <= troop.attackRange) {
    troop.state = 'attacking';
    applyDamage(troop.targetId, troop.dps * (deltaMs / 1000), buildings, defenses);
  } else {
    troop.state = 'moving';
    const pos = moveToward(troop.x, troop.y, targetPos.x, targetPos.y, troop.movementSpeed, deltaMs);
    troop.x = pos.x;
    troop.y = pos.y;
  }
}

/** Process one defense for the current tick. Mutates defense and troops. */
function processDefense(
  defense: ActiveDefense, troops: DeployedTroop[], elapsed: number, deltaMs: number,
): void {
  if (defense.isDestroyed) return;

  if (defense.targetTroopId) {
    const target = troops.find((t) => t.id === defense.targetTroopId);
    if (!target || target.state === 'dead') defense.targetTroopId = null;
  }

  if (!defense.targetTroopId) defense.targetTroopId = findDefenseTarget(defense, troops);
  if (!defense.targetTroopId) return;
  if (elapsed - defense.lastAttackTime < defense.attackSpeed) return;

  const target = troops.find((t) => t.id === defense.targetTroopId);
  if (!target || target.state === 'dead') return;

  target.currentHp = Math.max(0, target.currentHp - defense.dps * (deltaMs / 1000));
  if (target.currentHp <= 0) { target.state = 'dead'; target.currentHp = 0; defense.targetTroopId = null; }
  defense.lastAttackTime = elapsed;
}

/** Run a single simulation tick, advancing the battle by deltaMs milliseconds. */
export function tickBattle(state: BattleState, deltaMs: number): BattleState {
  if (state.phase === 'ended') return state;

  const timeRemaining = state.timeRemaining - deltaMs / 1000;
  if (timeRemaining <= 0) {
    const { stars, destructionPercent } = calculateStars(state.buildings);
    return { ...state, timeRemaining: 0, phase: 'ended', stars, destructionPercent };
  }

  const buildings = state.buildings.map((b) => ({ ...b }));
  const defenses = state.defenses.map((d) => ({ ...d }));
  const troops = state.deployedTroops.map((t) => ({ ...t }));
  const elapsed = BATTLE_DURATION - timeRemaining;

  for (const troop of troops) processTroop(troop, buildings, defenses, deltaMs);
  for (const defense of defenses) processDefense(defense, troops, elapsed, deltaMs);

  // Apply active spell effects (healing, rage, poison, etc.)
  const spellResult = tickSpells(state.spells, troops, buildings, defenses, deltaMs);

  const { stars, destructionPercent } = calculateStars(spellResult.buildings);
  const allDead = spellResult.troops.every((t) => t.state === 'dead');
  const noneLeft = state.availableTroops.length === 0;
  const phase = destructionPercent >= 100 || (allDead && noneLeft) ? 'ended' : state.phase;

  return {
    ...state, phase, timeRemaining, deployedTroops: spellResult.troops,
    defenses: spellResult.defenses, buildings: spellResult.buildings,
    spells: spellResult.spells, stars, destructionPercent,
  };
}

/** Build the final BattleResult from the current state and trophy offer. */
export function getBattleResult(state: BattleState, trophyOffer: number): BattleResult {
  return {
    stars: state.stars, destructionPercent: state.destructionPercent,
    loot: { ...state.loot }, trophyChange: state.stars > 0 ? trophyOffer : -trophyOffer,
    timeUsed: BATTLE_DURATION - state.timeRemaining,
  };
}

/** Check whether the battle is over. */
export function isBattleOver(state: BattleState): boolean {
  if (state.phase === 'ended' || state.timeRemaining <= 0) return true;
  if (state.destructionPercent >= 100) return true;
  return state.deployedTroops.every((t) => t.state === 'dead') && state.availableTroops.length === 0;
}
