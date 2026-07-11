// Siege machine management: training, deployment, and battle behavior.
// All functions are pure: they return new state, never mutate.

import type { DeployedTroop } from '../types/battle.ts';
import type { VillageState, TrainedTroop } from '../types/village.ts';
import { siegeMachines } from '../data/loaders/economy-loader.ts';
import { getArmyBuilding } from '../data/loaders/army-building-loader.ts';
import type { SiegeMachineData } from '../types/troops.ts';

// -- Types --

export interface SiegeDeployment {
  siegeName: string;
  level: number;
  ccTroops: Array<{ name: string; level: number; count: number }>;
}

export interface SiegeTrainingCost {
  amount: number;
  resource: string;
  time: number; // seconds
}

// -- Constants --

const MIN_TH_FOR_SIEGE = 12;
const MAX_SIEGE_PER_ATTACK = 1;
const SIEGE_TRAINING_COST = 100000;
const SIEGE_TRAINING_RESOURCE = 'Elixir';
const SIEGE_TRAINING_TIME = 1200;

// -- Public API --

/** Get all siege machine data. */
export function getAllSiegeMachines(): SiegeMachineData[] {
  return [...siegeMachines];
}

/** Get siege machine data by name. */
export function getSiegeMachine(name: string): SiegeMachineData | undefined {
  return siegeMachines.find((s) => s.name === name);
}

/** Check if siege machines are available at this TH level. */
export function areSiegeMachinesAvailable(thLevel: number): boolean {
  return thLevel >= MIN_TH_FOR_SIEGE;
}

/** Get the workshop level from village buildings. */
export function getWorkshopLevel(state: VillageState): number {
  const workshop = state.buildings.find((b) => b.buildingId === 'Workshop');
  return workshop?.level ?? 0;
}

/** Check if a specific siege machine can be trained. */
export function canTrainSiege(
  state: VillageState,
  siegeName: string,
): boolean {
  if (state.townHallLevel < MIN_TH_FOR_SIEGE) return false;

  const workshopLevel = getWorkshopLevel(state);
  if (workshopLevel === 0) return false;

  const siege = getSiegeMachine(siegeName);
  if (!siege) return false;

  // Check workshop level requirement
  if (siege.workshopLevelRequired > workshopLevel) return false;

  return true;
}

/** Get siege machines available for the current TH and workshop level. */
export function getAvailableSiegeMachines(state: VillageState): SiegeMachineData[] {
  if (state.townHallLevel < MIN_TH_FOR_SIEGE) return [];

  const workshopLevel = getWorkshopLevel(state);
  if (workshopLevel === 0) return [];

  return siegeMachines.filter((s) => s.workshopLevelRequired <= workshopLevel);
}

/**
 * Deploy a siege machine in battle. Creates a DeployedTroop that paths toward
 * the Town Hall. Carried CC troops are released by the battle engine when the
 * machine is destroyed or reaches the Town Hall.
 */
export function deploySiegeMachine(
  siegeName: string,
  level: number,
  deployX: number,
  deployY: number,
  carriedTroops: Array<{ name: string; level: number; count: number }> = [],
): DeployedTroop | null {
  const siege = getSiegeMachine(siegeName);
  if (!siege) return null;

  const levelStats = siege.levels.find((l) => l.level === level);
  if (!levelStats) return null;

  return {
    id: `siege_${siegeName}_${Date.now()}`,
    name: siegeName,
    level,
    currentHp: levelStats.hp,
    maxHp: levelStats.hp,
    x: deployX,
    y: deployY,
    targetId: null,
    state: 'idle',
    dps: levelStats.dps,
    baseDps: levelStats.dps,
    attackRange: 1,
    movementSpeed: siege.movementSpeed,
    isFlying: siege.isFlying,
    // Siege-specific: paths to the Town Hall, ignores defending units
    isSiegeMachine: true,
    canJumpWalls: true,
    deathDamage: levelStats.deathDamage,
    deathDamageRadius: levelStats.deathDamageRadius ?? 3,
    ...(carriedTroops.length > 0 ? { carriedTroops } : {}),
  };
}

// -- Training --

/** Get the flat training cost for a siege machine. */
export function getSiegeTrainingCost(siegeName: string): SiegeTrainingCost | undefined {
  if (!getSiegeMachine(siegeName)) return undefined;
  return {
    amount: SIEGE_TRAINING_COST,
    resource: SIEGE_TRAINING_RESOURCE,
    time: SIEGE_TRAINING_TIME,
  };
}

/** How many siege machines the Workshop can hold at its current level. */
export function getSiegeCapacity(state: VillageState): number {
  const workshopLevel = getWorkshopLevel(state);
  if (workshopLevel === 0) return 0;
  const workshop = getArmyBuilding('Workshop');
  const levelData = workshop?.levels.find((l) => l.level === workshopLevel);
  return levelData?.siegeCapacity ?? 0;
}

/** Get the trained siege machines (empty for saves that predate the system). */
export function getTrainedSiegeMachines(state: VillageState): TrainedTroop[] {
  return state.siegeMachines ?? [];
}

/** Total siege machines currently trained. */
export function getTrainedSiegeCount(state: VillageState): number {
  return getTrainedSiegeMachines(state).reduce((sum, s) => sum + s.count, 0);
}

/**
 * Train one siege machine: checks TH/Workshop gating, Workshop capacity, and
 * cost. Returns the new state or null if training is not possible.
 */
export function trainSiegeMachine(state: VillageState, siegeName: string): VillageState | null {
  if (!canTrainSiege(state, siegeName)) return null;
  if (getTrainedSiegeCount(state) >= getSiegeCapacity(state)) return null;

  const cost = getSiegeTrainingCost(siegeName);
  if (!cost || state.resources.elixir < cost.amount) return null;

  const resources = { ...state.resources, elixir: state.resources.elixir - cost.amount };
  const trained = getTrainedSiegeMachines(state);
  const existingIndex = trained.findIndex((s) => s.name === siegeName);
  const siegeMachinesNext = existingIndex >= 0
    ? trained.map((s, i) => (i === existingIndex ? { ...s, count: s.count + 1 } : s))
    : [...trained, { name: siegeName, level: 1, count: 1 }];

  return { ...state, resources, siegeMachines: siegeMachinesNext };
}

/** Remove one trained siege machine by name. */
export function removeSiegeMachine(state: VillageState, siegeName: string): VillageState {
  const siegeMachinesNext = getTrainedSiegeMachines(state)
    .map((s) => (s.name === siegeName ? { ...s, count: s.count - 1 } : s))
    .filter((s) => s.count > 0);
  return { ...state, siegeMachines: siegeMachinesNext };
}

/** Get max siege machines per attack. */
export function getMaxSiegePerAttack(): number {
  return MAX_SIEGE_PER_ATTACK;
}

/** Get the minimum TH level for siege machines. */
export function getMinTHForSiege(): number {
  return MIN_TH_FOR_SIEGE;
}
