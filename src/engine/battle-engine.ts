import type {
  BattleState, DeployedTroop, ActiveDefense, BattleBuilding, BattleResult,
  DefenderCCState, LootBundle, HeroBattleBoost, PetAssignment,
} from '../types/battle.ts';
import type { PlacedBuilding, TrainedTroop } from '../types/village.ts';
import type { XBowMode } from '../types/common.ts';
import type { TomeInvincibility, ShieldStrike } from './hero-manager.ts';
import { getDefense } from '../data/loaders/defense-loader.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { findTroopTarget, findDefenseTarget, canDefenseTarget, moveToward, distance, findBlockingWall } from './targeting-ai.ts';
import { tickSpells } from './spell-engine.ts';
import { processDefenseSpecial, processBombTowerDeath } from './defense-behaviors.ts';
import { processTroopSpecial, processDeathSpawns, processDeathDamage } from './troop-mechanics.ts';
import { deployHero, activateHeroAbility } from './hero-manager.ts';
import { applyBattleBoost } from './equipment-manager.ts';
import { createPetTroop, tickPetAbilities } from './pet-manager.ts';
import { shouldDeployDefensiveCC, deployDefensiveCCTroops, deployOffensiveCCTroops } from './cc-troops-manager.ts';
import { deploySiegeMachine } from './siege-manager.ts';
import { distributeLootAcrossBuildings } from './loot-calculator.ts';

const BATTLE_DURATION = 180;
const DEFAULT_BUILDING_HP = 500;
const UNIT_AGGRO_RADIUS = 12;
const HERO_ABILITY_HP_THRESHOLD = 0.5;
const SIEGE_RELEASE_RANGE = 1.5;

/** Optional battle setup: attacker heroes, raid loot, and defender-side units. */
export interface BattleInitOptions {
  attackerHeroes?: Array<{
    name: string;
    level: number;
    boost?: HeroBattleBoost;
    pet?: PetAssignment;
  }>;
  availableLoot?: LootBundle;
  attackerCastleTroops?: Array<{ name: string; level: number; count: number }>;
  attackerSiege?: { name: string; level: number };
  defenderCastleTroops?: Array<{ name: string; level: number; count: number }>;
  defenderHeroes?: Array<{ name: string; level: number; x: number; y: number }>;
}

// Fallback ranges for defenses whose JSON data has a null range.
const DEFAULT_DEFENSE_RANGES: Record<string, { min: number; max: number }> = {
  'X-Bow': { min: 0, max: 11.5 },
  'Inferno Tower': { min: 0, max: 9 },
};

// X-Bow mode tradeoff: ground-only reaches 14 tiles, ground+air only 11.5.
const XBOW_MODE_SETTINGS: Record<XBowMode, { range: { min: number; max: number }; targetType: 'ground' | 'ground_and_air' }> = {
  ground: { range: { min: 0, max: 14 }, targetType: 'ground' },
  ground_and_air: { range: { min: 0, max: 11.5 }, targetType: 'ground_and_air' },
};

export const DEFAULT_XBOW_MODE: XBowMode = 'ground_and_air';
const SCATTERSHOT_SPLASH_RADIUS = 2.5;

/** Some defense data files use `hitpoints` instead of `hp` (e.g. Scattershot). */
function resolveLevelHp(levelStats: { hp?: number; hitpoints?: number } | undefined): number | undefined {
  return levelStats?.hp ?? levelStats?.hitpoints;
}

/** Normalize raw range data (object, plain number, or null) into {min, max}. */
function normalizeRange(name: string, range: unknown): { min: number; max: number } {
  if (typeof range === 'number') return { min: 0, max: range };
  if (range && typeof range === 'object') {
    const r = range as { min?: number; max?: number };
    if (typeof r.min === 'number' && typeof r.max === 'number') {
      return { min: r.min, max: r.max };
    }
  }
  return DEFAULT_DEFENSE_RANGES[name] ?? { min: 0, max: 9 };
}

/** Normalize targetType data into the three values the engine understands. */
function normalizeTargetType(raw: unknown): 'ground' | 'air' | 'ground_and_air' {
  if (raw === 'ground' || raw === 'ground_only') return 'ground';
  if (raw === 'air') return 'air';
  return 'ground_and_air';
}

/** Apply the player-selected X-Bow mode: range and legal targets. */
export function applyXBowMode(defense: ActiveDefense, mode: XBowMode): void {
  const settings = XBOW_MODE_SETTINGS[mode];
  defense.xbowMode = mode;
  defense.range = { ...settings.range };
  defense.targetType = settings.targetType;
}

/**
 * Build the defender clan castle garrison state. Bases without a placed
 * Clan Castle building (e.g. NPC bases) stage the garrison at the Town Hall.
 */
function buildDefenderCC(
  defender: { buildings: PlacedBuilding[] },
  castleTroops: Array<{ name: string; level: number; count: number }>,
): DefenderCCState | null {
  if (castleTroops.length === 0) return null;
  const anchor = defender.buildings.find((p) => p.buildingId === 'Clan Castle')
    ?? defender.buildings.find((p) => p.buildingId === 'Town Hall')
    ?? defender.buildings[0];
  if (!anchor) return null;
  return { troops: castleTroops, x: anchor.gridX, y: anchor.gridY, deployed: false };
}

/** Initialize a fresh battle state from the defender's village and attacker's army. */
export function initBattleState(
  defender: { buildings: PlacedBuilding[] }, attackerArmy: TrainedTroop[], attackerSpells: TrainedTroop[],
  options?: BattleInitOptions,
): BattleState {
  const buildings: BattleBuilding[] = [];
  const defenses: ActiveDefense[] = [];

  for (const placed of defender.buildings) {
    const defData = getDefense(placed.buildingId);
    const levelStats = defData?.levels.find((l) => l.level === placed.level);
    const hp = resolveLevelHp(levelStats) ?? DEFAULT_BUILDING_HP;

    buildings.push({
      instanceId: placed.instanceId, name: placed.buildingId,
      currentHp: hp, maxHp: hp, x: placed.gridX, y: placed.gridY,
      isDestroyed: false, weight: placed.buildingId === 'Wall' ? 0 : 1,
    });

    if (placed.buildingType === 'defense' && defData && levelStats) {
      const dps = (levelStats as { dps: number }).dps;
      const def: ActiveDefense = {
        buildingInstanceId: placed.instanceId, name: placed.buildingId,
        level: placed.level, currentHp: hp, maxHp: hp,
        x: placed.gridX, y: placed.gridY, targetTroopId: null,
        dps, baseDps: dps,
        range: normalizeRange(placed.buildingId, defData.range),
        attackSpeed: typeof defData.attackSpeed === 'number' ? defData.attackSpeed : 1,
        lastAttackTime: 0, isDestroyed: false,
        targetType: normalizeTargetType(defData.targetType),
      };

      // Set special defense properties
      if (placed.buildingId === 'Inferno Tower') {
        def.infernoMode = 'single'; // Default to single; could be toggled
        def.infernoRampTime = 0;
        def.infernoMaxTargets = 5;
      } else if (placed.buildingId === 'Hidden Tesla') {
        def.isHidden = true;
        def.revealTriggerRange = 6;
      } else if (placed.buildingId === 'Eagle Artillery') {
        def.eagleActivated = false;
        def.eagleActivationThreshold = 200;
        def.range = { min: 7, max: 50 };
      } else if (placed.buildingId === 'Mortar') {
        def.range = { min: 4, max: def.range.max };
        def.splashRadius = 1.5;
      } else if (placed.buildingId === 'Air Sweeper') {
        def.pushbackStrength = 3;
        def.pushbackArc = 120;
      } else if (placed.buildingId === 'Bomb Tower') {
        def.splashRadius = 1.5;
        def.deathDamage = dps * 3;
        def.deathDamageRadius = 3;
      } else if (placed.buildingId === 'Wizard Tower') {
        def.splashRadius = 1;
      } else if (placed.buildingId === 'X-Bow') {
        applyXBowMode(def, placed.xbowMode ?? DEFAULT_XBOW_MODE);
        def.maxAmmo = placed.maxAmmo ?? 1000;
        def.ammo = Math.min(placed.ammo ?? def.maxAmmo, def.maxAmmo);
      } else if (placed.buildingId === 'Scattershot') {
        const shotDamage = dps * def.attackSpeed;
        def.scatterSplashDamage = (levelStats as { splashDamage?: number }).splashDamage ?? shotDamage * 0.75;
        def.scatterSplashRadius = SCATTERSHOT_SPLASH_RADIUS;
        def.maxAmmo = placed.maxAmmo ?? 90;
        def.ammo = Math.min(placed.ammo ?? def.maxAmmo, def.maxAmmo);
      }

      defenses.push(def);
    }
  }

  // Spread the raid's available loot across the buildings that hold it
  if (options?.availableLoot) {
    const shares = distributeLootAcrossBuildings(options.availableLoot, defender.buildings);
    for (const b of buildings) {
      const share = shares[b.instanceId];
      if (share) b.storedLoot = share;
    }
  }

  // Defender-side heroes start on the field guarding their base
  const deployedTroops: DeployedTroop[] = [];
  for (const dh of options?.defenderHeroes ?? []) {
    const hero = deployHero(dh.name, dh.level, dh.x, dh.y, true);
    if (hero) deployedTroops.push(hero);
  }

  const defenderCC = buildDefenderCC(defender, options?.defenderCastleTroops ?? []);

  return {
    phase: 'active', timeRemaining: BATTLE_DURATION, destructionPercent: 0, stars: 0,
    deployedTroops, defenses, buildings, spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: attackerArmy.map((t) => ({ name: t.name, level: t.level, count: t.count })),
    availableSpells: attackerSpells.map((s) => ({ name: s.name, level: s.level, count: s.count })),
    availableHeroes: (options?.attackerHeroes ?? []).map((h) => ({ ...h, deployed: false })),
    ...(defenderCC ? { defenderCC } : {}),
    ...(options?.attackerCastleTroops && options.attackerCastleTroops.length > 0
      ? { attackerCC: { troops: options.attackerCastleTroops, deployed: false } }
      : {}),
    ...(options?.attackerSiege ? { attackerSiege: { ...options.attackerSiege, deployed: false } } : {}),
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
    targetId: null, state: 'idle', dps: levelStats.dps, baseDps: levelStats.dps,
    attackRange: troopData.attackRange, movementSpeed: troopData.movementSpeed,
    isFlying: troopData.isFlying,
  };

  // Set special troop properties
  if (troopName === 'Wall Breaker') {
    deployed.selfDestructs = true;
    deployed.wallDamageMultiplier = 40;
  } else if (troopName === 'Goblin') {
    deployed.resourceDamageMultiplier = 2;
  } else if (troopName === 'Healer') {
    deployed.healPerSecond = levelStats.dps; // Healers use DPS stat as heal/sec
    deployed.healRadius = 5;
    deployed.dps = 0; // Healers don't deal damage
    deployed.baseDps = 0;
  } else if (troopName === 'Baby Dragon') {
    // Enrage check happens each tick
  } else if (troopName === 'Miner') {
    deployed.isBurrowed = false;
  } else if (troopName === 'Electro Dragon') {
    deployed.chainTargets = 4;
    deployed.chainDamageDecay = 0.75;
  } else if (troopName === 'Golem') {
    deployed.deathSpawnName = 'Golemite';
    deployed.deathSpawnCount = 2;
  } else if (troopName === 'Lava Hound') {
    deployed.deathSpawnName = 'Lava Pup';
    deployed.deathSpawnCount = 6;
  } else if (troopName === 'Balloon') {
    deployed.deathDamage = levelStats.dps * 2;
    deployed.deathDamageRadius = 1.5;
  } else if (troopName === 'Valkyrie') {
    deployed.splashRadius = 1;
  } else if (troopName === 'Hog Rider') {
    deployed.canJumpWalls = true;
  }

  const updatedAvailable = state.availableTroops
    .map((t, i) => (i === idx ? { ...t, count: t.count - 1 } : t))
    .filter((t) => t.count > 0);

  return { ...state, deployedTroops: [...state.deployedTroops, deployed], availableTroops: updatedAvailable };
}

/**
 * Deploy one of the attacker's heroes at the given position, applying its
 * equipment boost and dropping its assigned pet alongside it.
 * Each hero can be deployed once per battle. Returns null if unavailable.
 */
export function deployHeroToBattle(
  state: BattleState, heroName: string, x: number, y: number,
): BattleState | null {
  const heroesList = state.availableHeroes ?? [];
  const entry = heroesList.find((h) => h.name === heroName && !h.deployed);
  if (!entry) return null;

  const freshHero = deployHero(heroName, entry.level, x, y);
  if (!freshHero) return null;

  const hero = entry.recalledTroop
    ? { ...entry.recalledTroop, id: freshHero.id, x, y, targetId: null, state: 'idle' as const }
    : freshHero;

  const boosted = entry.boost && !entry.recalledTroop ? applyBattleBoost(hero, entry.boost) : hero;
  const freshPet = entry.pet ? createPetTroop(entry.pet.name, entry.pet.level, x, y) : null;
  const pet = entry.pet?.recalledTroop && freshPet
    ? {
        ...entry.pet.recalledTroop,
        id: freshPet.id,
        x: freshPet.x,
        y: freshPet.y,
        targetId: null,
        state: 'idle' as const,
      }
    : freshPet;
  if (pet) pet.ownerHeroName = heroName;
  const arrivals = pet ? [boosted, pet] : [boosted];

  return {
    ...state,
    deployedTroops: [...state.deployedTroops, ...arrivals],
    availableHeroes: heroesList.map((h) => (h.name === heroName
      ? {
          ...h,
          deployed: true,
          recalledTroop: undefined,
          pet: h.pet ? { ...h.pet, recalledTroop: undefined } : h.pet,
        }
      : h)),
  };
}

/**
 * Deploy the attacker's clan castle troops at the given position.
 * One deploy per battle. Returns null if none remain or already deployed.
 */
export function deployAttackerCC(
  state: BattleState, x: number, y: number,
): BattleState | null {
  const cc = state.attackerCC;
  if (!cc || cc.deployed) return null;

  const arrivals = deployOffensiveCCTroops(cc.troops, x, y);
  if (arrivals.length === 0) return null;

  return {
    ...state,
    deployedTroops: [...state.deployedTroops, ...arrivals],
    attackerCC: { ...cc, deployed: true },
  };
}

/**
 * Deploy the attacker's siege machine at the given position (one per attack).
 * Undeployed attacker CC troops ride inside and are released when the machine
 * is destroyed or reaches the Town Hall. Returns null if unavailable.
 */
export function deploySiegeToBattle(
  state: BattleState, x: number, y: number,
): BattleState | null {
  const siege = state.attackerSiege;
  if (!siege || siege.deployed) return null;

  const cargo = state.attackerCC && !state.attackerCC.deployed ? state.attackerCC : null;
  const unit = deploySiegeMachine(siege.name, siege.level, x, y, cargo?.troops ?? []);
  if (!unit) return null;

  return {
    ...state,
    deployedTroops: [...state.deployedTroops, unit],
    attackerSiege: { ...siege, deployed: true },
    ...(cargo ? { attackerCC: { ...cargo, deployed: true } } : {}),
  };
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

/** Check if a troop ignores walls (flying, jump spell active, or innate wall jump). */
function canIgnoreWalls(troop: DeployedTroop): boolean {
  return troop.isFlying || troop.canJumpWalls === true || troop.jumpSpellActive === true;
}

/** Check whether one unit may legally engage another in troop-vs-troop combat. */
function canUnitTargetUnit(attacker: DeployedTroop, target: DeployedTroop): boolean {
  if (target.state === 'dead' || target.isBurrowed) return false;
  if ((attacker.isDefender === true) === (target.isDefender === true)) return false;
  // Ground melee units cannot reach flying units
  if (target.isFlying && !attacker.isFlying && attacker.attackRange <= 1) return false;
  return true;
}

/** Find the nearest living enemy-side unit within maxRange. */
function findNearestEnemyUnit(
  troop: DeployedTroop, allTroops: DeployedTroop[], maxRange: number,
): DeployedTroop | null {
  let best: DeployedTroop | null = null;
  let bestDist = Infinity;
  for (const other of allTroops) {
    if (!canUnitTargetUnit(troop, other)) continue;
    const d = distance(troop.x, troop.y, other.x, other.y);
    if (d > maxRange || d >= bestDist) continue;
    bestDist = d;
    best = other;
  }
  return best;
}

/** Move toward or strike an enemy unit. Mutates both units within a tick. */
function engageUnit(troop: DeployedTroop, target: DeployedTroop, deltaMs: number): void {
  troop.targetId = target.id;
  const dist = distance(troop.x, troop.y, target.x, target.y);
  if (dist <= Math.max(troop.attackRange, 0.5)) {
    troop.state = 'attacking';
    target.currentHp = Math.max(0, target.currentHp - effectiveTroopDps(troop) * (deltaMs / 1000));
    if (target.currentHp <= 0) target.state = 'dead';
    return;
  }
  troop.state = 'moving';
  const pos = moveToward(troop.x, troop.y, target.x, target.y, troop.movementSpeed, deltaMs);
  troop.x = pos.x;
  troop.y = pos.y;
}

/** Defender-side unit AI: pursue and fight attacker units, never buildings. */
function processDefenderUnit(troop: DeployedTroop, allTroops: DeployedTroop[], deltaMs: number): void {
  const current = allTroops.find((t) => t.id === troop.targetId);
  if (current && canUnitTargetUnit(troop, current)) {
    engageUnit(troop, current, deltaMs);
    return;
  }
  troop.targetId = null;

  // Only wake up when an attacker comes within aggro range
  const target = findNearestEnemyUnit(troop, allTroops, UNIT_AGGRO_RADIUS);
  if (!target) { troop.state = 'idle'; return; }
  engageUnit(troop, target, deltaMs);
}

/** Troops without a favorite-target preference respond to defending units. */
function respondsToDefenders(troop: DeployedTroop): boolean {
  if (troop.dps <= 0 || troop.isSiegeMachine) return false;
  const favorite = getTroop(troop.name)?.favoriteTarget ?? null;
  return favorite === null || favorite === 'Any Building';
}

/** Resolve a unit's favorite target: sieges always path to the Town Hall. */
function troopFavoriteTarget(troop: DeployedTroop): string | null {
  if (troop.isSiegeMachine) return 'Town Hall';
  if (troop.favoriteTargetOverride) return troop.favoriteTargetOverride;
  return getTroop(troop.name)?.favoriteTarget ?? null;
}

function effectiveTroopDps(troop: DeployedTroop): number {
  return troop.dps * (troop.attackRateMultiplier ?? 1);
}

/** Attacker-side troop-vs-troop combat. Returns true if the troop engaged a defender unit. */
function tryUnitCombat(troop: DeployedTroop, allTroops: DeployedTroop[], deltaMs: number): boolean {
  if (!respondsToDefenders(troop)) return false;

  const current = allTroops.find((t) => t.id === troop.targetId);
  if (current && canUnitTargetUnit(troop, current)) {
    engageUnit(troop, current, deltaMs);
    return true;
  }

  const target = findNearestEnemyUnit(troop, allTroops, UNIT_AGGRO_RADIUS);
  if (!target) return false;
  engageUnit(troop, target, deltaMs);
  return true;
}

/** Process one troop for the current tick. Mutates troop, buildings, and defenses. */
function processTroop(
  troop: DeployedTroop, allTroops: DeployedTroop[],
  buildings: BattleBuilding[], defenses: ActiveDefense[], deltaMs: number,
): void {
  if (troop.state === 'dead') return;

  // Defender-owned units (CC troops, defending heroes) only fight attacker units
  if (troop.isDefender) {
    processDefenderUnit(troop, allTroops, deltaMs);
    return;
  }

  // Run special troop mechanics (may modify DPS, burrowed state, etc.)
  const specialHandled = processTroopSpecial(troop, allTroops, buildings, defenses, deltaMs);

  // Defending units distract attacker troops that have no favorite target
  if (tryUnitCombat(troop, allTroops, deltaMs)) return;

  // Clear dead target.
  if (troop.targetId && !findTargetPos(troop.targetId, buildings, defenses)) {
    troop.targetId = null;
    troop.state = 'idle';
  }

  // Acquire target.
  if (!troop.targetId) {
    troop.targetId = findTroopTarget(troop, buildings, defenses, troopFavoriteTarget(troop));
    if (!troop.targetId) return;
  }

  const targetPos = findTargetPos(troop.targetId, buildings, defenses);
  if (!targetPos) { troop.targetId = null; troop.state = 'idle'; return; }

  // Wall collision: if a wall blocks the path and troop can't jump, attack the wall instead
  if (!canIgnoreWalls(troop)) {
    const blockingWallId = findBlockingWall(troop, targetPos.x, targetPos.y, buildings);
    if (blockingWallId && blockingWallId !== troop.targetId) {
      troop.targetId = blockingWallId;
      const wallPos = findTargetPos(blockingWallId, buildings, defenses);
      if (wallPos) {
        const wallDist = distance(troop.x, troop.y, wallPos.x, wallPos.y);
        if (wallDist <= troop.attackRange) {
          troop.state = 'attacking';
          if (!specialHandled) {
            applyDamage(blockingWallId, effectiveTroopDps(troop) * (deltaMs / 1000), buildings, defenses);
          }
          return;
        }
        // Move toward the blocking wall
        troop.state = 'moving';
        const pos = moveToward(troop.x, troop.y, wallPos.x, wallPos.y, troop.movementSpeed, deltaMs);
        troop.x = pos.x;
        troop.y = pos.y;
        return;
      }
    }
  }

  const dist = distance(troop.x, troop.y, targetPos.x, targetPos.y);
  if (dist <= troop.attackRange) {
    troop.state = 'attacking';
    // Only apply normal damage if special handler didn't already handle it
    if (!specialHandled) {
      applyDamage(troop.targetId, effectiveTroopDps(troop) * (deltaMs / 1000), buildings, defenses);
    }
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
  destructionPercent: number, totalHousingDeployed: number,
): void {
  if (defense.isDestroyed) return;
  if (defense.ammo !== undefined && defense.ammo <= 0) return;

  // Try special defense behavior first
  const ctx = { troops, elapsed, deltaMs, destructionPercent, totalHousingDeployed };
  const lastAttackBeforeSpecial = defense.lastAttackTime;
  if (processDefenseSpecial(defense, ctx)) {
    if (defense.lastAttackTime > lastAttackBeforeSpecial && defense.ammo !== undefined) {
      defense.ammo = Math.max(0, defense.ammo - 1);
    }
    return;
  }

  // Standard defense behavior
  if (defense.targetTroopId) {
    const target = troops.find((t) => t.id === defense.targetTroopId);
    if (!target || target.state === 'dead') defense.targetTroopId = null;
  }

  // Filter out burrowed miners and friendly defender units from targeting
  const targetable = troops.filter((t) => !t.isBurrowed && !t.isDefender);
  if (!defense.targetTroopId) defense.targetTroopId = findDefenseTarget(defense, targetable);
  if (!defense.targetTroopId) return;

  const target = troops.find((t) => t.id === defense.targetTroopId);
  if (!target || target.state === 'dead') return;

  // Drop locked targets that have left the defense's range
  const targetDist = distance(defense.x, defense.y, target.x, target.y);
  if (targetDist < defense.range.min || targetDist > defense.range.max) {
    defense.targetTroopId = null;
    return;
  }
  if (elapsed - defense.lastAttackTime < defense.attackSpeed) return;

  // Each shot deals one attack cycle worth of damage (dps * seconds per shot)
  const shotDamage = defense.dps * defense.attackSpeed;
  if (defense.splashRadius && defense.splashRadius > 0) {
    // Splash defenses (Wizard Tower, Bomb Tower) hit everything near the target
    for (const t of targetable) {
      if (t.state === 'dead') continue;
      if (!canDefenseTarget(defense, t)) continue;
      if (distance(target.x, target.y, t.x, t.y) > defense.splashRadius) continue;
      t.currentHp = Math.max(0, t.currentHp - shotDamage);
      if (t.currentHp <= 0) { t.state = 'dead'; t.currentHp = 0; }
    }
    if (target.currentHp <= 0) defense.targetTroopId = null;
  } else {
    target.currentHp = Math.max(0, target.currentHp - shotDamage);
    if (target.currentHp <= 0) { target.state = 'dead'; target.currentHp = 0; defense.targetTroopId = null; }
  }
  defense.lastAttackTime = elapsed;
  if (defense.ammo !== undefined) defense.ammo = Math.max(0, defense.ammo - 1);
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

  // Release the defender clan castle garrison once attackers come near
  let defenderCC = state.defenderCC;
  if (defenderCC && !defenderCC.deployed && shouldDeployDefensiveCC(state, defenderCC.x, defenderCC.y)) {
    troops.push(...deployDefensiveCCTroops(defenderCC.troops, defenderCC.x, defenderCC.y));
    defenderCC = { ...defenderCC, deployed: true };
  }

  // Auto-activate hero abilities once a hero drops to the HP threshold
  const abilitySummons: DeployedTroop[] = [];
  for (let i = 0; i < troops.length; i++) {
    const t = troops[i]!;
    if (!t.isHero || t.heroAbilityUsed || t.state === 'dead') continue;
    if (t.currentHp > t.maxHp * HERO_ABILITY_HP_THRESHOLD) continue;
    const ability = activateHeroAbility(t, t.name, t.level, elapsed);
    // Heroes below the ability-unlock level have nothing to fire; stop checking
    if (!ability) { t.heroAbilityUsed = true; continue; }
    troops[i] = ability.hero;
    abilitySummons.push(...ability.summonedTroops);
    if (ability.tomeInvincibility) {
      applyTomeInvincibility(troops, ability.hero, ability.tomeInvincibility, elapsed);
    }
    if (ability.shieldStrike) {
      applySeekingShield(ability.hero, ability.shieldStrike, buildings, defenses);
    }
  }
  troops.push(...abilitySummons);

  // Calculate housing deployed for Eagle Artillery activation
  const totalHousingDeployed = state.deployedTroops.length * 5; // Approximation: 5 housing per troop
  const currentDestruction = calculateStars(buildings).destructionPercent;

  for (const troop of troops) {
    // Expire hero cloak invisibility (Archer Queen's Royal Cloak)
    if (troop.invisibleUntil !== undefined && elapsed >= troop.invisibleUntil) {
      troop.invisibleUntil = undefined;
      troop.isBurrowed = false;
    }
    // Expire Eternal Tome invincibility
    if (troop.invincibleUntil !== undefined && elapsed >= troop.invincibleUntil) {
      troop.invincibleUntil = undefined;
    }
    // Clone Spell copies vanish once their lifespan runs out
    if (troop.isClone && troop.state !== 'dead' && troop.cloneLifespanRemaining !== undefined) {
      troop.cloneLifespanRemaining -= deltaMs / 1000;
      if (troop.cloneLifespanRemaining <= 0) { troop.state = 'dead'; troop.currentHp = 0; }
    }
    if (troop.poisonedUntil !== undefined) {
      if (elapsed < troop.poisonedUntil) {
        troop.currentHp = Math.max(0, troop.currentHp - (troop.poisonDamagePerSecond ?? 0) * deltaMs / 1000);
        if (troop.currentHp <= 0) troop.state = 'dead';
      } else {
        troop.poisonedUntil = undefined;
        troop.poisonDamagePerSecond = undefined;
        troop.attackRateMultiplier = 1;
        if (troop.baseMovementSpeed !== undefined) troop.movementSpeed = troop.baseMovementSpeed;
      }
    }
    if (troop.favoriteTargetOverrideUntil !== undefined && elapsed >= troop.favoriteTargetOverrideUntil) {
      troop.favoriteTargetOverride = undefined;
      troop.favoriteTargetOverrideUntil = undefined;
    }
    // Healing block only lasts while a single-target Inferno stays locked on
    troop.healingNerfed = defenses.some((d) =>
      d.name === 'Inferno Tower' && !d.isDestroyed && !d.isFrozen
      && d.infernoMode !== 'multi' && d.targetTroopId === troop.id);
  }

  troops.push(...tickPetAbilities(troops, defenses, elapsed, deltaMs));
  applyWardenLifeAura(troops);

  // Snapshot HP of Eternal Tome protected troops; restored after damage phases
  const invincibleHp = new Map<string, number>();
  for (const troop of troops) {
    if (troop.state === 'dead') continue;
    if (troop.invincibleUntil !== undefined && elapsed < troop.invincibleUntil) {
      invincibleHp.set(troop.id, troop.currentHp);
    }
  }

  for (const troop of troops) processTroop(troop, troops, buildings, defenses, deltaMs);

  // Handle troop death effects (spawns, death damage)
  const newSpawns: DeployedTroop[] = [];
  for (const troop of troops) {
    if (troop.state !== 'dead') continue;
    if (troop.deathSpawnName) {
      newSpawns.push(...processDeathSpawns(troop));
      troop.deathSpawnName = undefined; // Only spawn once
    }
    if (troop.deathDamage) {
      processDeathDamage(troop, buildings, defenses);
      troop.deathDamage = undefined; // Only explode once
    }
  }
  troops.push(...newSpawns);

  // Siege machines release their carried CC troops on death or at the Town Hall
  troops.push(...releaseSiegeCargo(troops, buildings));

  for (const defense of defenses) {
    const wasAlive = !defense.isDestroyed;
    processDefense(defense, troops, elapsed, deltaMs, currentDestruction, totalHousingDeployed);
    // Handle Bomb Tower death explosion
    if (wasAlive && defense.isDestroyed && defense.name === 'Bomb Tower') {
      processBombTowerDeath(defense, troops);
    }
  }

  // Apply active spell effects (healing, rage, poison, etc.)
  const spellResult = tickSpells(state.spells, troops, buildings, defenses, deltaMs);

  // Eternal Tome: protected troops shrug off all damage taken this tick
  const finalTroops = invincibleHp.size === 0
    ? spellResult.troops
    : spellResult.troops.map((t) => restoreInvincibleHp(t, invincibleHp));

  // Award stored loot from buildings destroyed this tick
  const loot = collectDestroyedLoot(spellResult.buildings, state.loot);

  const { stars, destructionPercent } = calculateStars(spellResult.buildings);
  const attackers = finalTroops.filter((t) => !t.isDefender);
  const allDead = attackers.every((t) => t.state === 'dead');
  const noneLeft = state.availableTroops.length === 0 && !hasUndeployedHeroes(state)
    && !hasUndeployedCC(state) && !hasUndeployedSiege(state);
  const phase = destructionPercent >= 100 || (allDead && noneLeft) ? 'ended' : state.phase;

  return {
    ...state, phase, timeRemaining, deployedTroops: finalTroops,
    defenses: spellResult.defenses, buildings: spellResult.buildings,
    spells: spellResult.spells, stars, destructionPercent, loot,
    ...(defenderCC ? { defenderCC } : {}),
  };
}

export function applyWardenLifeAura(troops: DeployedTroop[]): void {
  const previous = new Map<string, { applied: boolean; currentHp: number }>();
  for (const troop of troops) {
    if (troop.lifeAuraBaseMaxHp !== undefined) {
      previous.set(troop.id, { applied: troop.lifeAuraApplied === true, currentHp: troop.currentHp });
      troop.maxHp = troop.lifeAuraBaseMaxHp;
      troop.currentHp = Math.min(troop.currentHp, troop.maxHp);
      troop.lifeAuraApplied = false;
    }
  }

  const wardens = troops.filter(troop => troop.name === 'Grand Warden'
    && troop.state !== 'dead' && !troop.isDefender && (troop.lifeAuraBoostPercent ?? 0) > 0);
  for (const warden of wardens) {
    for (const troop of troops) {
      if (troop.state === 'dead' || troop.isDefender || troop.id === warden.id) continue;
      if (distance(warden.x, warden.y, troop.x, troop.y) > (warden.lifeAuraRadius ?? 7)) continue;
      const baseMaxHp = troop.lifeAuraBaseMaxHp ?? troop.maxHp;
      const boostedMaxHp = baseMaxHp * (1 + (warden.lifeAuraBoostPercent ?? 0) / 100);
      const gain = boostedMaxHp - baseMaxHp;
      troop.lifeAuraBaseMaxHp = baseMaxHp;
      troop.maxHp = boostedMaxHp;
      const prior = previous.get(troop.id);
      troop.currentHp = prior?.applied
        ? Math.min(boostedMaxHp, prior.currentHp)
        : Math.min(boostedMaxHp, troop.currentHp + gain);
      troop.lifeAuraApplied = true;
    }
  }
}

/** Grant Eternal Tome invincibility to nearby attacker-side units. */
function applyTomeInvincibility(
  troops: DeployedTroop[], warden: DeployedTroop, tome: TomeInvincibility, elapsed: number,
): void {
  const until = elapsed + tome.durationSeconds;
  for (const t of troops) {
    if (t.state === 'dead' || t.isDefender) continue;
    if (distance(warden.x, warden.y, t.x, t.y) > tome.radius) continue;
    t.invincibleUntil = until;
  }
}

/** Royal Champion's shield bounces between the nearest surviving defenses. */
function applySeekingShield(
  hero: DeployedTroop, strike: ShieldStrike,
  buildings: BattleBuilding[], defenses: ActiveDefense[],
): void {
  const targets = defenses
    .filter((d) => !d.isDestroyed)
    .sort((a, b) => distance(hero.x, hero.y, a.x, a.y) - distance(hero.x, hero.y, b.x, b.y))
    .slice(0, strike.targets);
  for (const target of targets) {
    applyDamage(target.buildingInstanceId, strike.damage, buildings, defenses);
  }
}

/** Undo damage dealt this tick to a troop protected by the Eternal Tome. */
function restoreInvincibleHp(
  troop: DeployedTroop, invincibleHp: Map<string, number>,
): DeployedTroop {
  const savedHp = invincibleHp.get(troop.id);
  if (savedHp === undefined || troop.currentHp >= savedHp) return troop;
  return {
    ...troop,
    currentHp: savedHp,
    state: troop.state === 'dead' ? 'idle' : troop.state,
  };
}

/** True while the attacker still has an unspent hero deploy. */
function hasUndeployedHeroes(state: BattleState): boolean {
  return (state.availableHeroes ?? []).some((h) => !h.deployed);
}

/** True while the attacker still has an unspent clan castle deploy. */
function hasUndeployedCC(state: BattleState): boolean {
  return state.attackerCC !== undefined && !state.attackerCC.deployed;
}

/** True while the attacker still has an unspent siege machine deploy. */
function hasUndeployedSiege(state: BattleState): boolean {
  return state.attackerSiege !== undefined && !state.attackerSiege.deployed;
}

/** Check whether a siege machine has closed to Town Hall release range. */
function hasReachedTownHall(troop: DeployedTroop, buildings: BattleBuilding[]): boolean {
  const townHall = buildings.find((b) => b.name === 'Town Hall');
  if (!townHall) return false;
  const releaseRange = Math.max(troop.attackRange, SIEGE_RELEASE_RANGE);
  return distance(troop.x, troop.y, townHall.x, townHall.y) <= releaseRange;
}

/**
 * Release CC troops carried by siege machines that died or reached the
 * Town Hall this tick. Clears the cargo so it only releases once.
 */
function releaseSiegeCargo(
  troops: DeployedTroop[], buildings: BattleBuilding[],
): DeployedTroop[] {
  const released: DeployedTroop[] = [];
  for (const troop of troops) {
    if (!troop.carriedTroops || troop.carriedTroops.length === 0) continue;
    if (troop.state !== 'dead' && !hasReachedTownHall(troop, buildings)) continue;
    released.push(...deployOffensiveCCTroops(troop.carriedTroops, troop.x, troop.y));
    troop.carriedTroops = undefined;
  }
  return released;
}

/**
 * Sum the stored loot of newly destroyed buildings into the running total.
 * Clears each building's storedLoot so it only pays out once.
 */
function collectDestroyedLoot(
  buildings: BattleBuilding[], current: BattleState['loot'],
): BattleState['loot'] {
  let { gold, elixir, darkElixir } = current;
  let changed = false;
  for (const b of buildings) {
    if (!b.isDestroyed || !b.storedLoot) continue;
    gold += b.storedLoot.gold;
    elixir += b.storedLoot.elixir;
    darkElixir += b.storedLoot.darkElixir;
    b.storedLoot = undefined;
    changed = true;
  }
  return changed ? { gold, elixir, darkElixir } : current;
}

/** Build the final BattleResult from the current state and trophy offer. */
export function getBattleResult(state: BattleState, trophyOffer: number): BattleResult {
  const heroesDeployed = state.deployedTroops
    .filter((t) => t.isHero && !t.isDefender)
    .map((t) => ({ name: t.name, level: t.level, remainingHp: t.state === 'dead' ? 0 : t.currentHp }));

  return {
    stars: state.stars, destructionPercent: state.destructionPercent,
    loot: { ...state.loot }, trophyChange: state.stars > 0 ? trophyOffer : -trophyOffer,
    timeUsed: BATTLE_DURATION - state.timeRemaining,
    ...(heroesDeployed.length > 0 ? { heroesDeployed } : {}),
  };
}

/** Check whether the battle is over. */
export function isBattleOver(state: BattleState): boolean {
  if (state.phase === 'ended' || state.timeRemaining <= 0) return true;
  if (state.destructionPercent >= 100) return true;
  if (state.availableTroops.length > 0 || hasUndeployedHeroes(state)) return false;
  if (hasUndeployedCC(state) || hasUndeployedSiege(state)) return false;
  return state.deployedTroops.every((t) => t.isDefender || t.state === 'dead');
}
