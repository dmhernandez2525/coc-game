// Clan Castle troop management for battle: auto-fill, defensive deployment,
// and offensive deployment mechanics.
// All functions are pure: they return new state, never mutate.

import type { DeployedTroop, BattleState } from '../types/battle.ts';
import type { ClanState } from './clan-manager.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { getCastleCapacity } from './clan-manager.ts';

// -- Types --

export interface CCDeployConfig {
  aggroRadius: number;       // Tiles from CC before defensive troops deploy
  deployOffsetRange: number; // Random offset from CC position
}

const DEFAULT_CC_CONFIG: CCDeployConfig = {
  aggroRadius: 12,
  deployOffsetRange: 2,
};

// -- Auto-fill --

/** Auto-fill the clan castle with appropriate troops for the given TH level. */
export function autoFillCastleTroops(
  clan: ClanState,
  thLevel: number,
): ClanState {
  const capacity = getCastleCapacity(thLevel);
  if (capacity <= 0) return clan;

  // Pick sensible troops based on TH level
  const troopPicks = getTroopPicksForTH(thLevel);
  let remaining = capacity;
  const troops: Array<{ name: string; level: number; count: number }> = [];

  for (const pick of troopPicks) {
    if (remaining <= 0) break;
    const data = getTroop(pick.name);
    if (!data) continue;

    const canFit = Math.floor(remaining / data.housingSpace);
    if (canFit <= 0) continue;

    const count = Math.min(canFit, pick.maxCount);
    troops.push({ name: pick.name, level: pick.level, count });
    remaining -= count * data.housingSpace;
  }

  return { ...clan, castleTroops: troops };
}

/** Get sensible troop picks for a TH level. */
function getTroopPicksForTH(
  thLevel: number,
): Array<{ name: string; level: number; maxCount: number }> {
  const picks: Record<number, Array<{ name: string; level: number; maxCount: number }>> = {
    3: [{ name: 'Archer', level: 2, maxCount: 5 }],
    4: [{ name: 'Wizard', level: 1, maxCount: 2 }, { name: 'Archer', level: 3, maxCount: 5 }],
    5: [{ name: 'Wizard', level: 2, maxCount: 2 }, { name: 'Balloon', level: 2, maxCount: 2 }],
    6: [{ name: 'Wizard', level: 3, maxCount: 3 }, { name: 'Archer', level: 4, maxCount: 5 }],
    7: [{ name: 'Dragon', level: 1, maxCount: 1 }, { name: 'Wizard', level: 4, maxCount: 2 }],
    8: [{ name: 'Dragon', level: 3, maxCount: 1 }, { name: 'Wizard', level: 5, maxCount: 3 }],
    9: [{ name: 'Lava Hound', level: 1, maxCount: 1 }, { name: 'Wizard', level: 5, maxCount: 2 }],
    10: [{ name: 'Electro Dragon', level: 1, maxCount: 1 }, { name: 'Wizard', level: 6, maxCount: 2 }],
  };

  // Default: use the highest TH that has a configuration, capped at the given level
  const keys = Object.keys(picks).map(Number).sort((a, b) => a - b);
  let bestKey = keys[0] ?? 3;
  for (const k of keys) {
    if (k <= thLevel) bestKey = k;
  }

  return picks[bestKey] ?? [{ name: 'Archer', level: 1, maxCount: 5 }];
}

// -- Defensive CC deployment --

/**
 * Check if any attacker troop is within aggro range of the Clan Castle building.
 * Returns true if defensive CC troops should deploy.
 */
export function shouldDeployDefensiveCC(
  state: BattleState,
  ccX: number,
  ccY: number,
  config: CCDeployConfig = DEFAULT_CC_CONFIG,
): boolean {
  for (const troop of state.deployedTroops) {
    if (troop.state === 'dead') continue;
    const dx = troop.x - ccX;
    const dy = troop.y - ccY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= config.aggroRadius) return true;
  }
  return false;
}

/**
 * Deploy defensive CC troops around the Clan Castle position.
 * Returns an array of DeployedTroop to add to the battle.
 */
export function deployDefensiveCCTroops(
  castleTroops: ClanState['castleTroops'],
  ccX: number,
  ccY: number,
  config: CCDeployConfig = DEFAULT_CC_CONFIG,
): DeployedTroop[] {
  const deployed: DeployedTroop[] = [];
  let idCounter = 0;

  for (const entry of castleTroops) {
    const data = getTroop(entry.name);
    if (!data) continue;

    const levelStats = data.levels.find((l) => l.level === entry.level) ?? data.levels[0];
    if (!levelStats) continue;

    for (let i = 0; i < entry.count; i++) {
      idCounter++;
      const offsetX = (Math.random() - 0.5) * 2 * config.deployOffsetRange;
      const offsetY = (Math.random() - 0.5) * 2 * config.deployOffsetRange;

      deployed.push({
        id: `cc_def_${entry.name}_${idCounter}`,
        name: entry.name,
        level: entry.level,
        currentHp: levelStats.hp,
        maxHp: levelStats.hp,
        x: ccX + offsetX,
        y: ccY + offsetY,
        targetId: null,
        state: 'idle',
        dps: levelStats.dps,
        baseDps: levelStats.dps,
        attackRange: 1,
        movementSpeed: data.movementSpeed,
        isFlying: data.isFlying,
      });
    }
  }

  return deployed;
}

// -- Offensive CC deployment --

/**
 * Deploy offensive CC troops at a specified position during attack.
 * Returns an array of DeployedTroop.
 */
export function deployOffensiveCCTroops(
  castleTroops: ClanState['castleTroops'],
  deployX: number,
  deployY: number,
): DeployedTroop[] {
  const deployed: DeployedTroop[] = [];
  let idCounter = 0;

  for (const entry of castleTroops) {
    const data = getTroop(entry.name);
    if (!data) continue;

    const levelStats = data.levels.find((l) => l.level === entry.level) ?? data.levels[0];
    if (!levelStats) continue;

    for (let i = 0; i < entry.count; i++) {
      idCounter++;
      const offsetX = (Math.random() - 0.5) * 3;
      const offsetY = (Math.random() - 0.5) * 3;

      deployed.push({
        id: `cc_off_${entry.name}_${idCounter}`,
        name: entry.name,
        level: entry.level,
        currentHp: levelStats.hp,
        maxHp: levelStats.hp,
        x: deployX + offsetX,
        y: deployY + offsetY,
        targetId: null,
        state: 'idle',
        dps: levelStats.dps,
        baseDps: levelStats.dps,
        attackRange: 1,
        movementSpeed: data.movementSpeed,
        isFlying: data.isFlying,
      });
    }
  }

  return deployed;
}

/**
 * Get the total housing space of CC troops.
 */
export function getCCTroopHousing(
  castleTroops: ClanState['castleTroops'],
): number {
  let total = 0;
  for (const entry of castleTroops) {
    const data = getTroop(entry.name);
    if (!data) continue;
    total += entry.count * data.housingSpace;
  }
  return total;
}
