// Campaign battle simulator: deterministic outcome based on army power vs NPC power.
// All functions are pure: they return new state, never mutate.

import type { TrainedTroop } from '../types/village.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import {
  getCampaignBattleConfig,
  calculateCampaignStars,
  calculateCampaignLoot,
} from './campaign-battle.ts';

export interface CampaignBattleResult {
  stars: number;
  destructionPercent: number;
  townHallDestroyed: boolean;
  loot: { gold: number; elixir: number; darkElixir: number } | null;
}

/** Calculate the total combat power of an army. Considers count, level, HP and DPS. */
function calculateArmyPower(army: TrainedTroop[]): number {
  let power = 0;
  for (const troop of army) {
    const data = getTroop(troop.name);
    if (!data) {
      power += troop.count * troop.level * 100;
      continue;
    }
    const levelStats = data.levels.find((l) => l.level === troop.level);
    const hp = (levelStats as { hp?: number } | undefined)?.hp ?? 100;
    const dps = (levelStats as { dps?: number } | undefined)?.dps ?? 10;
    power += troop.count * (hp + dps * 10) * troop.level;
  }
  return power;
}

/**
 * Simulate a campaign battle. Returns a deterministic result based on
 * the player's army power relative to the NPC army power for the level.
 *
 * Power ratio mapping (approximate):
 *   0.0x -> 0% destruction
 *   0.5x -> ~35% destruction
 *   1.0x -> ~60% destruction
 *   1.5x -> ~75% destruction
 *   2.0x -> ~85% destruction
 *   3.0x+ -> ~95%+ destruction
 */
export function simulateCampaignBattle(
  playerArmy: TrainedTroop[],
  levelNumber: number,
): CampaignBattleResult | null {
  const config = getCampaignBattleConfig(levelNumber);
  if (!config) return null;

  const playerPower = calculateArmyPower(playerArmy);
  const npcPower = calculateArmyPower(config.npcArmy);

  if (playerPower === 0) {
    return { stars: 0, destructionPercent: 0, townHallDestroyed: false, loot: null };
  }

  const ratio = playerPower / Math.max(1, npcPower);

  // Smooth curve: higher ratio = more destruction, diminishing returns past 2x
  const destructionPercent = Math.min(100, Math.round(100 * (1 - Math.exp(-ratio * 0.9))));

  // Town Hall is destroyed when player has clear advantage or high destruction
  const townHallDestroyed = destructionPercent >= 70 || ratio >= 1.3;

  const stars = calculateCampaignStars(
    destructionPercent,
    townHallDestroyed,
    config.starThresholds,
  );

  const loot = calculateCampaignLoot(levelNumber, stars);

  return { stars, destructionPercent, townHallDestroyed, loot };
}
