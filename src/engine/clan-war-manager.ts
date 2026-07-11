// Clan War system: NPC clan generation, war base assignment, attack tracking,
// NPC attack simulation, results, and war loot.
// All functions are pure: they return new state, never mutate.
// Randomized steps accept an injectable RNG so tests stay deterministic.

import type { NPCBase } from '../data/npc-bases.ts';
import { getNPCBasesMatchingTH, getNPCBaseById } from '../data/npc-bases.ts';
import type { Rng } from '../utils/seeded-rng.ts';

// -- Types --

export interface WarClanMember {
  name: string;
  townHallLevel: number;
  attacksRemaining: number;
  bestAttackStars: number;
  bestAttackDestruction: number;
  /** NPC base layout this member defends with (war base). */
  warBaseId?: string;
}

export interface WarClan {
  name: string;
  members: WarClanMember[];
  totalStars: number;
  totalDestruction: number;
}

export type WarPhase = 'preparation' | 'battle' | 'ended';

export interface WarState {
  phase: WarPhase;
  playerClan: WarClan;
  enemyClan: WarClan;
  warSize: number; // 5v5, 10v10, 15v15
  preparationTimeRemaining: number; // seconds
  battleTimeRemaining: number; // seconds
  /** Layout the player's clan defends with, chosen during preparation. */
  playerWarBaseId?: string;
  /** Final outcome, set when the war ends. */
  result?: WarResult;
  /** Loot actually credited to the treasury when the war ended. */
  lootAwarded?: { gold: number; elixir: number; darkElixir: number };
}

export interface WarAttackResult {
  attackerIndex: number;
  defenderIndex: number;
  stars: number;
  destructionPercent: number;
}

export type WarResult = 'victory' | 'defeat' | 'draw';

// -- Constants --

const WAR_SIZES = [5, 10, 15] as const;
const ATTACKS_PER_MEMBER = 2;
const PREPARATION_TIME = 86400; // 24 hours in seconds
const BATTLE_TIME = 86400; // 24 hours in seconds

const NPC_CLAN_NAMES = [
  'Goblin Horde', 'Shadow Raiders', 'Dark Legion', 'Iron Fist',
  'Thunder Clan', 'Frost Warriors', 'Flame Guard', 'Stone Crushers',
  'Night Wolves', 'Storm Riders', 'Blood Axes', 'Skull Breakers',
  'Dragon Slayers', 'Eagle Eyes', 'Ghost Regiment',
];

// How strongly the defending war base's quality suppresses NPC attack stars.
const DEFENSE_RATING_WEIGHT = 0.3;

// -- Public API --

/** Get available war sizes. */
export function getWarSizes(): readonly number[] {
  return WAR_SIZES;
}

/** Pick a war base layout for a defender of the given TH level. */
function pickWarBaseId(thLevel: number, rng: Rng): string | undefined {
  const pool = getNPCBasesMatchingTH(thLevel);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(rng() * pool.length)]?.id;
}

/** Generate an NPC enemy clan matched to the player's TH levels. */
export function generateEnemyClan(
  playerMembers: WarClanMember[],
  rng: Rng = Math.random,
): WarClan {
  const nameIndex = Math.floor(rng() * NPC_CLAN_NAMES.length);
  const clanName = NPC_CLAN_NAMES[nameIndex] ?? 'Goblin Horde';

  // Generate mirrored members with slight TH variation, each defending
  // a real base layout from the NPC library.
  const enemyMembers: WarClanMember[] = playerMembers.map((pm, i) => {
    const thVariation = rng() > 0.7 ? 1 : 0;
    const direction = rng() > 0.5 ? 1 : -1;
    const thLevel = Math.max(1, pm.townHallLevel + thVariation * direction);
    const warBaseId = pickWarBaseId(thLevel, rng);

    return {
      name: `NPC ${clanName} #${i + 1}`,
      townHallLevel: thLevel,
      attacksRemaining: ATTACKS_PER_MEMBER,
      bestAttackStars: 0,
      bestAttackDestruction: 0,
      ...(warBaseId !== undefined ? { warBaseId } : {}),
    };
  });

  return {
    name: clanName,
    members: enemyMembers,
    totalStars: 0,
    totalDestruction: 0,
  };
}

/** Start a new clan war. */
export function startWar(
  playerClanName: string,
  playerTHLevels: number[],
  warSize: number,
  rng: Rng = Math.random,
): WarState {
  const validSize = WAR_SIZES.includes(warSize as 5 | 10 | 15)
    ? warSize
    : WAR_SIZES[0]!;

  const memberCount = Math.min(validSize, playerTHLevels.length);

  // Sort by TH level descending for war map order
  const sortedTHs = [...playerTHLevels]
    .sort((a, b) => b - a)
    .slice(0, memberCount);

  const playerMembers: WarClanMember[] = sortedTHs.map((th, i) => ({
    name: `Player #${i + 1}`,
    townHallLevel: th,
    attacksRemaining: ATTACKS_PER_MEMBER,
    bestAttackStars: 0,
    bestAttackDestruction: 0,
  }));

  const playerClan: WarClan = {
    name: playerClanName,
    members: playerMembers,
    totalStars: 0,
    totalDestruction: 0,
  };

  const enemyClan = generateEnemyClan(playerMembers, rng);

  return {
    phase: 'preparation',
    playerClan,
    enemyClan,
    warSize: memberCount,
    preparationTimeRemaining: PREPARATION_TIME,
    battleTimeRemaining: BATTLE_TIME,
  };
}

/** War base layouts the player can defend with, given their TH level. */
export function getSelectableWarBases(thLevel: number): NPCBase[] {
  return getNPCBasesMatchingTH(thLevel);
}

/**
 * Choose the layout the player's clan defends with.
 * Only allowed during preparation day (scouting), like the real game.
 */
export function selectPlayerWarBase(war: WarState, baseId: string): WarState {
  if (war.phase !== 'preparation') return war;
  if (!getNPCBaseById(baseId)) return war;
  return { ...war, playerWarBaseId: baseId };
}

/**
 * Defensive quality of a war base, normalized to 0..1.
 * More defenses at higher levels rate closer to 1 for the base's TH.
 */
export function getWarBaseDefenseRating(base: NPCBase): number {
  const defenseLevels = base.buildings
    .filter((b) => b.buildingType === 'defense')
    .reduce((sum, b) => sum + b.level, 0);
  const expectedMax = 6 + base.townHallLevel * 8;
  return Math.min(1, defenseLevels / expectedMax);
}

/** Resolve the base layout an enemy war member defends with. */
export function getEnemyWarBase(war: WarState, defenderIndex: number): NPCBase | null {
  const member = war.enemyClan.members[defenderIndex];
  if (!member) return null;
  const assigned = member.warBaseId ? getNPCBaseById(member.warBaseId) : undefined;
  if (assigned) return assigned;
  // Fallback for wars started before base assignment existed
  return getNPCBasesMatchingTH(member.townHallLevel)[0] ?? null;
}

/** Index of the next player member with attacks left, or -1 when spent. */
export function getNextAttackerIndex(war: WarState): number {
  return war.playerClan.members.findIndex((m) => m.attacksRemaining > 0);
}

/** Advance the war to battle phase. */
export function startBattlePhase(war: WarState): WarState {
  if (war.phase !== 'preparation') return war;
  return { ...war, phase: 'battle', preparationTimeRemaining: 0 };
}

/**
 * Record a player attack on an enemy base.
 * Stars are only counted if they improve over the best existing attack on that base.
 */
export function recordPlayerAttack(
  war: WarState,
  attackerIndex: number,
  defenderIndex: number,
  stars: number,
  destructionPercent: number,
): WarState {
  if (war.phase !== 'battle') return war;

  const attacker = war.playerClan.members[attackerIndex];
  if (!attacker || attacker.attacksRemaining <= 0) return war;

  // Update attacker's remaining attacks
  const updatedPlayerMembers = war.playerClan.members.map((m, i) =>
    i === attackerIndex ? { ...m, attacksRemaining: m.attacksRemaining - 1 } : m,
  );

  // Calculate new stars earned (only count improvement)
  const existingBest = war.playerClan.members[defenderIndex]?.bestAttackStars ?? 0;
  const newStars = Math.max(0, stars - existingBest);

  // Track best attack per defender position. Destruction is tracked
  // independently of stars so the war tiebreaker counts every attack.
  const defenderRecord = updatedPlayerMembers[defenderIndex];
  if (defenderRecord) {
    updatedPlayerMembers[defenderIndex] = {
      ...defenderRecord,
      bestAttackStars: Math.max(defenderRecord.bestAttackStars, stars),
      bestAttackDestruction: Math.max(defenderRecord.bestAttackDestruction, destructionPercent),
    };
  }

  const totalStars = war.playerClan.totalStars + newStars;
  const totalDestruction = updatedPlayerMembers.reduce(
    (sum, m) => sum + m.bestAttackDestruction, 0,
  );

  return {
    ...war,
    playerClan: {
      ...war.playerClan,
      members: updatedPlayerMembers,
      totalStars,
      totalDestruction,
    },
  };
}

/** Star/destruction outcome for one simulated NPC attack roll. */
function rollNPCAttack(roll: number, starChance: number, rng: Rng): { stars: number; destruction: number } {
  if (roll < starChance * 0.3) return { stars: 3, destruction: 100 };
  if (roll < starChance * 0.6) return { stars: 2, destruction: 50 + Math.floor(rng() * 30) };
  if (roll < starChance) return { stars: 1, destruction: 30 + Math.floor(rng() * 20) };
  return { stars: 0, destruction: Math.floor(rng() * 30) };
}

/**
 * Simulate NPC attacks. Each NPC member attacks the mirror position.
 * Results are randomized based on TH difference, and suppressed by the
 * quality of the war base the player's clan selected during preparation.
 */
export function simulateNPCAttacks(war: WarState, rng: Rng = Math.random): WarState {
  if (war.phase !== 'battle') return war;

  const playerBase = war.playerWarBaseId ? getNPCBaseById(war.playerWarBaseId) : undefined;
  const defensePenalty = playerBase
    ? getWarBaseDefenseRating(playerBase) * DEFENSE_RATING_WEIGHT
    : 0;

  const updatedEnemyClan = { ...war.enemyClan, members: [...war.enemyClan.members] };
  let totalStars = 0;
  let totalDestruction = 0;

  for (let i = 0; i < updatedEnemyClan.members.length; i++) {
    const attacker = updatedEnemyClan.members[i]!;
    const defender = war.playerClan.members[i];
    if (!defender) continue;

    const thDiff = attacker.townHallLevel - defender.townHallLevel;
    // Higher TH advantage = more likely to get stars; a strong war base pushes back
    const baseStarChance = Math.max(0.05, 0.5 + thDiff * 0.15 - defensePenalty);

    let stars = 0;
    let destruction = 0;

    // Simulate 2 attacks
    for (let attack = 0; attack < ATTACKS_PER_MEMBER; attack++) {
      const outcome = rollNPCAttack(rng(), baseStarChance, rng);
      if (outcome.stars > stars) {
        stars = outcome.stars;
        destruction = Math.max(destruction, outcome.destruction);
      }
    }

    updatedEnemyClan.members[i] = {
      ...attacker,
      attacksRemaining: 0,
      bestAttackStars: stars,
      bestAttackDestruction: destruction,
    };

    totalStars += stars;
    totalDestruction += destruction;
  }

  return {
    ...war,
    enemyClan: {
      ...updatedEnemyClan,
      totalStars,
      totalDestruction,
    },
  };
}

/** End the war and determine the result. The result is stored on the state. */
export function endWar(war: WarState): { war: WarState; result: WarResult } {
  const playerStars = war.playerClan.totalStars;
  const enemyStars = war.enemyClan.totalStars;

  let result: WarResult;
  if (playerStars > enemyStars) {
    result = 'victory';
  } else if (playerStars < enemyStars) {
    result = 'defeat';
  } else {
    // Tiebreaker: total destruction percentage
    const playerDest = war.playerClan.totalDestruction;
    const enemyDest = war.enemyClan.totalDestruction;
    result = playerDest > enemyDest ? 'victory' : playerDest < enemyDest ? 'defeat' : 'draw';
  }

  const endedWar: WarState = { ...war, phase: 'ended', battleTimeRemaining: 0, result };

  return { war: endedWar, result };
}

/**
 * Calculate war loot based on result and TH levels.
 * The optional multiplier applies the war league bonus.
 */
export function calculateWarLoot(
  result: WarResult,
  playerTHLevel: number,
  leagueMultiplier = 1,
): { gold: number; elixir: number; darkElixir: number } {
  const baseLoot = playerTHLevel * 50000;
  const deLoot = playerTHLevel >= 7 ? playerTHLevel * 200 : 0;

  const multipliers: Record<WarResult, number> = {
    victory: 1.0,
    draw: 0.4,
    defeat: 0.2,
  };

  const multiplier = multipliers[result] * leagueMultiplier;

  return {
    gold: Math.floor(baseLoot * multiplier),
    elixir: Math.floor(baseLoot * multiplier),
    darkElixir: Math.floor(deLoot * multiplier),
  };
}
