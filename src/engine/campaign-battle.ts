// Campaign battle rules: NPC army composition, difficulty scaling, star calculation.
// All functions are pure: they return new state, never mutate.

import type { TrainedTroop } from '../types/village.ts';
import { getCampaignLevel } from './campaign-manager.ts';

// -- Types --

export interface CampaignBattleConfig {
  levelNumber: number;
  npcArmy: TrainedTroop[];
  npcTownHallLevel: number;
  timeLimit: number; // seconds
  starThresholds: { one: number; two: number; three: number }; // destruction %
}

// -- Constants --

const BASE_TIME_LIMIT = 180; // 3 minutes

// Each TH level unlocks more troop types for NPC armies
const NPC_ARMY_TEMPLATES: Record<number, Array<{ name: string; baseCount: number }>> = {
  1: [{ name: 'Barbarian', baseCount: 10 }],
  2: [{ name: 'Barbarian', baseCount: 12 }, { name: 'Archer', baseCount: 8 }],
  3: [{ name: 'Barbarian', baseCount: 10 }, { name: 'Archer', baseCount: 10 }, { name: 'Giant', baseCount: 2 }],
  4: [{ name: 'Barbarian', baseCount: 8 }, { name: 'Archer', baseCount: 12 }, { name: 'Giant', baseCount: 3 }, { name: 'Goblin', baseCount: 5 }],
  5: [{ name: 'Barbarian', baseCount: 10 }, { name: 'Archer', baseCount: 10 }, { name: 'Giant', baseCount: 4 }, { name: 'Wizard', baseCount: 3 }],
  6: [{ name: 'Barbarian', baseCount: 12 }, { name: 'Archer', baseCount: 12 }, { name: 'Giant', baseCount: 5 }, { name: 'Wizard', baseCount: 4 }, { name: 'Balloon', baseCount: 3 }],
  7: [{ name: 'Barbarian', baseCount: 10 }, { name: 'Archer', baseCount: 10 }, { name: 'Giant', baseCount: 6 }, { name: 'Wizard', baseCount: 5 }, { name: 'Dragon', baseCount: 2 }],
  8: [{ name: 'Giant', baseCount: 8 }, { name: 'Wizard', baseCount: 6 }, { name: 'Dragon', baseCount: 3 }, { name: 'P.E.K.K.A', baseCount: 1 }],
  9: [{ name: 'Giant', baseCount: 6 }, { name: 'Wizard', baseCount: 8 }, { name: 'Dragon', baseCount: 3 }, { name: 'P.E.K.K.A', baseCount: 2 }],
  10: [{ name: 'Wizard', baseCount: 8 }, { name: 'Dragon', baseCount: 4 }, { name: 'P.E.K.K.A', baseCount: 2 }, { name: 'Baby Dragon', baseCount: 3 }],
};

// Star thresholds vary by difficulty
const STAR_THRESHOLDS = {
  easy: { one: 30, two: 50, three: 100 },
  normal: { one: 40, two: 60, three: 100 },
  hard: { one: 50, two: 70, three: 100 },
};

// -- Public API --

/** Determine the NPC TH level for a campaign level. */
export function getCampaignNPCTownHall(levelNumber: number): number {
  // Roughly: level 1-10 = TH1, 11-20 = TH2, ..., 81-90 = TH9
  // With a floor of 1 and cap of 10
  return Math.min(10, Math.max(1, Math.ceil(levelNumber / 10)));
}

/** Get the difficulty tier for a campaign level. */
export function getCampaignDifficulty(levelNumber: number): 'easy' | 'normal' | 'hard' {
  const positionInGroup = ((levelNumber - 1) % 10);
  if (positionInGroup < 3) return 'easy';
  if (positionInGroup < 7) return 'normal';
  return 'hard';
}

/** Generate the NPC army for a campaign level. */
export function generateCampaignArmy(levelNumber: number): TrainedTroop[] {
  const thLevel = getCampaignNPCTownHall(levelNumber);
  const difficulty = getCampaignDifficulty(levelNumber);

  const template = NPC_ARMY_TEMPLATES[thLevel] ?? NPC_ARMY_TEMPLATES[1]!;

  // Scale counts based on difficulty
  const difficultyMultipliers = { easy: 0.7, normal: 1.0, hard: 1.3 };
  const multiplier = difficultyMultipliers[difficulty];

  // Troop levels scale with TH
  const troopLevel = Math.max(1, Math.ceil(thLevel * 0.8));

  return template.map((t) => ({
    name: t.name,
    level: troopLevel,
    count: Math.max(1, Math.round(t.baseCount * multiplier)),
  }));
}

/** Build the full battle config for a campaign level. */
export function getCampaignBattleConfig(levelNumber: number): CampaignBattleConfig | null {
  const level = getCampaignLevel(levelNumber);
  if (!level) return null;

  const npcTH = getCampaignNPCTownHall(levelNumber);
  const difficulty = getCampaignDifficulty(levelNumber);
  const npcArmy = generateCampaignArmy(levelNumber);
  const thresholds = STAR_THRESHOLDS[difficulty];

  return {
    levelNumber,
    npcArmy,
    npcTownHallLevel: npcTH,
    timeLimit: BASE_TIME_LIMIT,
    starThresholds: thresholds,
  };
}

/** Calculate stars earned from destruction percentage. */
export function calculateCampaignStars(
  destructionPercent: number,
  townHallDestroyed: boolean,
  thresholds: CampaignBattleConfig['starThresholds'],
): number {
  let stars = 0;

  if (destructionPercent >= thresholds.one || townHallDestroyed) stars = 1;
  if (destructionPercent >= thresholds.two) stars = 2;
  if (destructionPercent >= thresholds.three) stars = 3;

  return stars;
}

/** Calculate loot earned from a campaign battle. Scales with stars. */
export function calculateCampaignLoot(
  levelNumber: number,
  stars: number,
): { gold: number; elixir: number; darkElixir: number } | null {
  const level = getCampaignLevel(levelNumber);
  if (!level) return null;

  // Scale loot: 1 star = 50%, 2 stars = 75%, 3 stars = 100%
  const lootMultipliers: Record<number, number> = { 0: 0, 1: 0.5, 2: 0.75, 3: 1.0 };
  const multiplier = lootMultipliers[stars] ?? 0;

  return {
    gold: Math.floor(level.goldLoot * multiplier),
    elixir: Math.floor(level.elixirLoot * multiplier),
    darkElixir: Math.floor(level.darkElixirLoot * multiplier),
  };
}
