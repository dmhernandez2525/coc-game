// Siege machine management: training, deployment, and battle behavior.
// All functions are pure: they return new state, never mutate.

import type { DeployedTroop } from '../types/battle.ts';
import type { VillageState } from '../types/village.ts';
import { siegeMachines } from '../data/loaders/economy-loader.ts';
import type { SiegeMachineData } from '../types/troops.ts';

// -- Types --

export interface SiegeDeployment {
  siegeName: string;
  level: number;
  ccTroops: Array<{ name: string; level: number; count: number }>;
}

// -- Constants --

const MIN_TH_FOR_SIEGE = 12;
const MAX_SIEGE_PER_ATTACK = 1;

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
 * the Town Hall. On destruction, CC troops should be released (handled by battle engine).
 */
export function deploySiegeMachine(
  siegeName: string,
  level: number,
  deployX: number,
  deployY: number,
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
    // Siege-specific: will target Town Hall
    canJumpWalls: true,
    deathDamage: levelStats.deathDamage,
    deathDamageRadius: levelStats.deathDamageRadius ?? 3,
  };
}

/** Get max siege machines per attack. */
export function getMaxSiegePerAttack(): number {
  return MAX_SIEGE_PER_ATTACK;
}

/** Get the minimum TH level for siege machines. */
export function getMinTHForSiege(): number {
  return MIN_TH_FOR_SIEGE;
}
