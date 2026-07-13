import type { BattleState, DeployedTroop } from '../types/battle.ts';
import type {
  DefenseLogEntry,
  PlacedTrap,
  TrainedTroop,
  VillageState,
} from '../types/village.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { createStatistics, incrementStat } from './statistics-tracker.ts';
import { deployTroop, initBattleState, tickBattle } from './battle-engine.ts';
import { getTrapData, getTrapStats } from './trap-manager.ts';

const DEFENSE_LOG_LIMIT = 20;
const SIMULATION_TICK_MS = 250;
const MAX_SIMULATION_TICKS = (180 * 1000) / SIMULATION_TICK_MS;

export interface DefenseSimulationOptions {
  now?: number;
  attackerName?: string;
  attackerTownHallLevel?: number;
  attackerArmy?: TrainedTroop[];
}

export interface TrapTickResult {
  battle: BattleState;
  traps: PlacedTrap[];
  triggered: string[];
}

export interface DefenseSimulationResult {
  village: VillageState;
  entry: DefenseLogEntry;
}

function canTrapTarget(trapTarget: string, troop: DeployedTroop): boolean {
  if (trapTarget === 'ground' || trapTarget === 'ground_only') return !troop.isFlying;
  if (trapTarget === 'air') return troop.isFlying;
  return true;
}

function troopHousing(troop: DeployedTroop): number {
  return getTroop(troop.name)?.housingSpace ?? (troop.isHero || troop.isPet ? 25 : 1);
}

function livingAttackersInRange(
  battle: BattleState,
  trap: PlacedTrap,
  triggerRadius: number,
  targetType: string,
): DeployedTroop[] {
  return battle.deployedTroops
    .filter((troop) => !troop.isDefender && troop.state !== 'dead' && canTrapTarget(targetType, troop))
    .filter((troop) => Math.hypot(troop.x - trap.gridX, troop.y - trap.gridY) <= triggerRadius)
    .sort((a, b) => (
      Math.hypot(a.x - trap.gridX, a.y - trap.gridY)
      - Math.hypot(b.x - trap.gridX, b.y - trap.gridY)
    ));
}

function makeSkeletonDefender(trap: PlacedTrap, index: number, count: number): DeployedTroop {
  const angle = (Math.PI * 2 * index) / Math.max(1, count);
  return {
    id: `${trap.instanceId}_skeleton_${index}`,
    name: 'Skeleton',
    level: 1,
    currentHp: 30,
    maxHp: 30,
    x: trap.gridX + Math.cos(angle) * 0.5,
    y: trap.gridY + Math.sin(angle) * 0.5,
    targetId: null,
    state: 'idle',
    dps: 25,
    baseDps: 25,
    attackRange: 0.4,
    movementSpeed: 24,
    isFlying: false,
    isDefender: true,
  };
}

/** Fire every armed trap whose trigger conditions are met during this tick. */
export function triggerDefenseTraps(battle: BattleState, placedTraps: PlacedTrap[]): TrapTickResult {
  const troops = battle.deployedTroops.map((troop) => ({ ...troop }));
  const traps = placedTraps.map((trap) => ({ ...trap }));
  const triggered: string[] = [];
  const spawnedDefenders: DeployedTroop[] = [];

  for (const trap of traps) {
    if (!trap.isArmed) continue;
    const data = getTrapData(trap.trapId);
    const stats = getTrapStats(trap.trapId, trap.level);
    if (!data || !stats) continue;

    const currentBattle = { ...battle, deployedTroops: troops };
    const targets = livingAttackersInRange(
      currentBattle,
      trap,
      data.triggerRadius,
      data.targetType,
    );
    if (targets.length === 0) continue;
    if (trap.trapId === 'Seeking Air Mine' && troopHousing(targets[0]!) < 5) continue;
    if (trap.trapId === 'Giga Bomb'
      && targets.reduce((sum, troop) => sum + troopHousing(troop), 0) < 18) continue;

    trap.isArmed = false;
    triggered.push(trap.trapId);

    if (trap.trapId === 'Skeleton Trap') {
      const count = (stats as typeof stats & { skeletonCount?: number }).skeletonCount ?? 2;
      for (let index = 0; index < count; index++) {
        spawnedDefenders.push(makeSkeletonDefender(trap, index, count));
      }
      continue;
    }

    if (trap.trapId === 'Spring Trap') {
      const target = targets[0]!;
      const capacity = stats.capacity ?? 0;
      if (troopHousing(target) <= capacity) {
        target.currentHp = 0;
        target.state = 'dead';
      } else {
        target.currentHp = Math.max(0, target.currentHp - (stats.damage ?? 250));
        if (target.currentHp <= 0) target.state = 'dead';
      }
      continue;
    }

    const damage = stats.damage ?? (trap.trapId === 'Tornado Trap' ? 40 : 0);
    const damageRadius = data.damageRadius;
    const victims = damageRadius === null
      ? targets.slice(0, 1)
      : troops.filter((troop) => (
          !troop.isDefender
          && troop.state !== 'dead'
          && canTrapTarget(data.targetType, troop)
          && Math.hypot(troop.x - trap.gridX, troop.y - trap.gridY) <= damageRadius
        ));
    for (const troop of victims) {
      troop.currentHp = Math.max(0, troop.currentHp - damage);
      if (troop.currentHp <= 0) troop.state = 'dead';
      if (trap.trapId === 'Tornado Trap' && troop.state !== 'dead') {
        troop.x += (trap.gridX - troop.x) * 0.6;
        troop.y += (trap.gridY - troop.y) * 0.6;
      }
    }
  }

  return {
    battle: { ...battle, deployedTroops: [...troops, ...spawnedDefenders] },
    traps,
    triggered,
  };
}

function defaultAttackerArmy(townHallLevel: number): TrainedTroop[] {
  if (townHallLevel <= 2) return [{ name: 'Barbarian', level: 1, count: 18 }];
  if (townHallLevel <= 5) {
    return [
      { name: 'Giant', level: 1, count: 5 },
      { name: 'Archer', level: 1, count: 18 },
    ];
  }
  if (townHallLevel <= 8) {
    return [
      { name: 'Giant', level: 1, count: 8 },
      { name: 'Wizard', level: 1, count: 16 },
    ];
  }
  return [
    { name: 'Giant', level: 1, count: 10 },
    { name: 'Wizard', level: 1, count: 18 },
    { name: 'Dragon', level: 1, count: 3 },
  ];
}

function deploymentPoints(village: VillageState): Array<{ x: number; y: number }> {
  if (village.buildings.length === 0) return [{ x: 0, y: 0 }];
  const xs = village.buildings.map((building) => building.gridX);
  const ys = village.buildings.map((building) => building.gridY);
  const minX = Math.min(...xs) - 3;
  const maxX = Math.max(...xs) + 3;
  const minY = Math.min(...ys) - 3;
  const maxY = Math.max(...ys) + 3;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return [
    { x: centerX, y: minY },
    { x: maxX, y: centerY },
    { x: centerX, y: maxY },
    { x: minX, y: centerY },
  ];
}

function deployArmy(
  initial: BattleState,
  army: TrainedTroop[],
  points: Array<{ x: number; y: number }>,
): BattleState {
  let battle = initial;
  let deployedIndex = 0;
  for (const stack of army) {
    for (let index = 0; index < stack.count; index++) {
      const point = points[deployedIndex % points.length]!;
      const jitter = ((deployedIndex % 5) - 2) * 0.35;
      const next = deployTroop(battle, stack.name, point.x + jitter, point.y - jitter);
      if (!next) continue;
      const latestIndex = next.deployedTroops.length - 1;
      next.deployedTroops[latestIndex] = {
        ...next.deployedTroops[latestIndex]!,
        id: `defense_attacker_${deployedIndex}`,
      };
      battle = next;
      deployedIndex += 1;
    }
  }
  return battle;
}

function calculateLootStolen(village: VillageState, destructionPercent: number) {
  const share = destructionPercent <= 0 ? 0 : 0.02 + (destructionPercent / 100) * 0.18;
  return {
    gold: Math.floor(village.resources.gold * share),
    elixir: Math.floor(village.resources.elixir * share),
    darkElixir: Math.floor(village.resources.darkElixir * share),
  };
}

/** Run a complete incoming attack against the player's current base. */
export function simulateDefense(
  village: VillageState,
  options: DefenseSimulationOptions = {},
): DefenseSimulationResult {
  const now = options.now ?? Date.now();
  const attackerTownHallLevel = options.attackerTownHallLevel ?? village.townHallLevel;
  const attackerArmy = options.attackerArmy ?? defaultAttackerArmy(attackerTownHallLevel);
  const townHall = village.buildings.find((building) => building.buildingId === 'Town Hall');
  const defenderHeroes = village.heroes
    .filter((hero) => !hero.isRecovering && !hero.isUpgrading)
    .map((hero, index) => ({
      name: hero.name,
      level: hero.level,
      x: (townHall?.gridX ?? 20) + (index % 2 === 0 ? 2 : -2),
      y: (townHall?.gridY ?? 20) + (index < 2 ? 2 : -2),
    }));
  let battle = initBattleState(village, attackerArmy, [], {
    defenderCastleTroops: village.clan?.castleTroops ?? [],
    defenderHeroes,
  });
  battle = deployArmy(battle, attackerArmy, deploymentPoints(village));

  let traps = village.traps.map((trap) => ({ ...trap }));
  const trapsTriggered: string[] = [];
  for (let tick = 0; tick < MAX_SIMULATION_TICKS && battle.phase !== 'ended'; tick++) {
    const trapResult = triggerDefenseTraps(battle, traps);
    battle = tickBattle(trapResult.battle, SIMULATION_TICK_MS);
    traps = trapResult.traps;
    trapsTriggered.push(...trapResult.triggered);
  }

  const durationSeconds = Math.max(0, Math.round(180 - battle.timeRemaining));
  const wonDefense = battle.stars === 0;
  const trophyChange = wonDefense ? 5 : -(5 + battle.stars * 5);
  const lootStolen = calculateLootStolen(village, battle.destructionPercent);
  const entry: DefenseLogEntry = {
    id: `defense_${now}`,
    timestamp: now,
    attackerName: options.attackerName ?? `Raider TH${attackerTownHallLevel}`,
    attackerTownHallLevel,
    stars: battle.stars,
    destructionPercent: battle.destructionPercent,
    durationSeconds,
    trophyChange,
    trapsTriggered,
    lootStolen,
    result: wonDefense ? 'victory' : 'defeat',
  };

  const ammoByBuilding = new Map(
    battle.defenses
      .filter((defense) => defense.ammo !== undefined)
      .map((defense) => [defense.buildingInstanceId, {
        ammo: defense.ammo,
        maxAmmo: defense.maxAmmo,
      }]),
  );
  const stats = incrementStat(village.statistics ?? createStatistics(), 'totalDefenses');
  return {
    entry,
    village: {
      ...village,
      buildings: village.buildings.map((building) => {
        const ammo = ammoByBuilding.get(building.instanceId);
        return ammo ? { ...building, ...ammo } : building;
      }),
      traps,
      resources: {
        ...village.resources,
        gold: Math.max(0, village.resources.gold - lootStolen.gold),
        elixir: Math.max(0, village.resources.elixir - lootStolen.elixir),
        darkElixir: Math.max(0, village.resources.darkElixir - lootStolen.darkElixir),
      },
      trophies: Math.max(0, village.trophies + trophyChange),
      statistics: stats,
      defenseLog: [entry, ...(village.defenseLog ?? [])].slice(0, DEFENSE_LOG_LIMIT),
      lastDefenseAt: now,
    },
  };
}
