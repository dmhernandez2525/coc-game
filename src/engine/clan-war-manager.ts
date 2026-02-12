// Clan War system: NPC clan generation, war matching, attack simulation, results.
// All functions are pure: they return new state, never mutate.

// -- Types --

export interface WarClanMember {
  name: string;
  townHallLevel: number;
  attacksRemaining: number;
  bestAttackStars: number;
  bestAttackDestruction: number;
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

// -- Public API --

/** Get available war sizes. */
export function getWarSizes(): readonly number[] {
  return WAR_SIZES;
}

/** Generate an NPC enemy clan matched to the player's TH levels. */
export function generateEnemyClan(
  playerMembers: WarClanMember[],
): WarClan {
  const nameIndex = Math.floor(Math.random() * NPC_CLAN_NAMES.length);
  const clanName = NPC_CLAN_NAMES[nameIndex] ?? 'Goblin Horde';

  // Generate mirrored members with slight TH variation
  const enemyMembers: WarClanMember[] = playerMembers.map((pm, i) => {
    const thVariation = Math.random() > 0.7 ? 1 : 0;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const thLevel = Math.max(1, pm.townHallLevel + thVariation * direction);

    return {
      name: `NPC ${clanName} #${i + 1}`,
      townHallLevel: thLevel,
      attacksRemaining: ATTACKS_PER_MEMBER,
      bestAttackStars: 0,
      bestAttackDestruction: 0,
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

  const enemyClan = generateEnemyClan(playerMembers);

  return {
    phase: 'preparation',
    playerClan,
    enemyClan,
    warSize: memberCount,
    preparationTimeRemaining: PREPARATION_TIME,
    battleTimeRemaining: BATTLE_TIME,
  };
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

  // Track best attack per defender position
  if (stars > existingBest) {
    updatedPlayerMembers[defenderIndex] = {
      ...updatedPlayerMembers[defenderIndex]!,
      bestAttackStars: stars,
      bestAttackDestruction: Math.max(
        updatedPlayerMembers[defenderIndex]!.bestAttackDestruction,
        destructionPercent,
      ),
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

/**
 * Simulate NPC attacks. Each NPC member attacks the mirror position.
 * Results are randomized based on TH difference.
 */
export function simulateNPCAttacks(war: WarState): WarState {
  if (war.phase !== 'battle') return war;

  let updatedEnemyClan = { ...war.enemyClan, members: [...war.enemyClan.members] };
  let totalStars = 0;
  let totalDestruction = 0;

  for (let i = 0; i < updatedEnemyClan.members.length; i++) {
    const attacker = updatedEnemyClan.members[i]!;
    const defender = war.playerClan.members[i];
    if (!defender) continue;

    const thDiff = attacker.townHallLevel - defender.townHallLevel;
    // Higher TH advantage = more likely to get stars
    const baseStarChance = 0.5 + thDiff * 0.15;

    let stars = 0;
    let destruction = 0;

    // Simulate 2 attacks
    for (let attack = 0; attack < ATTACKS_PER_MEMBER; attack++) {
      const roll = Math.random();
      let attackStars: number;
      let attackDestruction: number;

      if (roll < baseStarChance * 0.3) {
        attackStars = 3;
        attackDestruction = 100;
      } else if (roll < baseStarChance * 0.6) {
        attackStars = 2;
        attackDestruction = 50 + Math.floor(Math.random() * 30);
      } else if (roll < baseStarChance) {
        attackStars = 1;
        attackDestruction = 30 + Math.floor(Math.random() * 20);
      } else {
        attackStars = 0;
        attackDestruction = Math.floor(Math.random() * 30);
      }

      if (attackStars > stars) {
        stars = attackStars;
        destruction = Math.max(destruction, attackDestruction);
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

/** End the war and determine the result. */
export function endWar(war: WarState): { war: WarState; result: WarResult } {
  const endedWar: WarState = { ...war, phase: 'ended', battleTimeRemaining: 0 };

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

  return { war: endedWar, result };
}

/** Calculate war loot based on result and TH levels. */
export function calculateWarLoot(
  result: WarResult,
  playerTHLevel: number,
): { gold: number; elixir: number; darkElixir: number } {
  const baseLoot = playerTHLevel * 50000;
  const deLoot = playerTHLevel >= 7 ? playerTHLevel * 200 : 0;

  const multipliers: Record<WarResult, number> = {
    victory: 1.0,
    draw: 0.4,
    defeat: 0.2,
  };

  const multiplier = multipliers[result];

  return {
    gold: Math.floor(baseLoot * multiplier),
    elixir: Math.floor(baseLoot * multiplier),
    darkElixir: Math.floor(deLoot * multiplier),
  };
}
