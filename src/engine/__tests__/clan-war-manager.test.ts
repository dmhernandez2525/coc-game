import type { WarState, WarClanMember, WarClan } from '../clan-war-manager.ts';
import {
  getWarSizes,
  generateEnemyClan,
  startWar,
  startBattlePhase,
  recordPlayerAttack,
  simulateNPCAttacks,
  endWar,
  calculateWarLoot,
} from '../clan-war-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMember(overrides?: Partial<WarClanMember>): WarClanMember {
  return {
    name: 'Test Member',
    townHallLevel: 8,
    attacksRemaining: 2,
    bestAttackStars: 0,
    bestAttackDestruction: 0,
    ...overrides,
  };
}

function makeClan(overrides?: Partial<WarClan>): WarClan {
  return {
    name: 'Test Clan',
    members: [makeMember()],
    totalStars: 0,
    totalDestruction: 0,
    ...overrides,
  };
}

function makeWarState(overrides?: Partial<WarState>): WarState {
  return {
    phase: 'battle',
    playerClan: makeClan({ name: 'Player Clan' }),
    enemyClan: makeClan({ name: 'Enemy Clan' }),
    warSize: 5,
    preparationTimeRemaining: 0,
    battleTimeRemaining: 86400,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getWarSizes
// ---------------------------------------------------------------------------

describe('getWarSizes', () => {
  it('returns an array of valid war sizes', () => {
    const sizes = getWarSizes();

    expect(Array.isArray(sizes)).toBe(true);
    expect(sizes.length).toBeGreaterThan(0);
  });

  it('includes 5, 10, and 15 as valid sizes', () => {
    const sizes = getWarSizes();

    expect(sizes).toContain(5);
    expect(sizes).toContain(10);
    expect(sizes).toContain(15);
  });

  it('returns sizes in ascending order', () => {
    const sizes = getWarSizes();

    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
    }
  });
});

// ---------------------------------------------------------------------------
// generateEnemyClan
// ---------------------------------------------------------------------------

describe('generateEnemyClan', () => {
  it('generates the correct number of enemy members to mirror player members', () => {
    const playerMembers = [makeMember(), makeMember(), makeMember()];
    const enemy = generateEnemyClan(playerMembers);

    expect(enemy.members).toHaveLength(3);
  });

  it('generates members with valid TH levels (at least 1)', () => {
    const playerMembers = Array.from({ length: 10 }, () => makeMember({ townHallLevel: 5 }));
    const enemy = generateEnemyClan(playerMembers);

    for (const member of enemy.members) {
      expect(member.townHallLevel).toBeGreaterThanOrEqual(1);
    }
  });

  it('generates members with TH levels close to the player members', () => {
    const playerMembers = [makeMember({ townHallLevel: 10 })];
    const enemy = generateEnemyClan(playerMembers);

    // TH variation is at most +/- 1
    expect(enemy.members[0]!.townHallLevel).toBeGreaterThanOrEqual(9);
    expect(enemy.members[0]!.townHallLevel).toBeLessThanOrEqual(11);
  });

  it('sets attacks remaining to 2 for all enemy members', () => {
    const playerMembers = [makeMember(), makeMember()];
    const enemy = generateEnemyClan(playerMembers);

    for (const member of enemy.members) {
      expect(member.attacksRemaining).toBe(2);
    }
  });

  it('starts with 0 total stars and 0 total destruction', () => {
    const playerMembers = [makeMember()];
    const enemy = generateEnemyClan(playerMembers);

    expect(enemy.totalStars).toBe(0);
    expect(enemy.totalDestruction).toBe(0);
  });

  it('assigns a clan name from the NPC names list', () => {
    const playerMembers = [makeMember()];
    const enemy = generateEnemyClan(playerMembers);

    expect(typeof enemy.name).toBe('string');
    expect(enemy.name.length).toBeGreaterThan(0);
  });

  it('names each member with the NPC clan prefix and index', () => {
    const playerMembers = [makeMember(), makeMember()];
    const enemy = generateEnemyClan(playerMembers);

    expect(enemy.members[0]!.name).toContain('#1');
    expect(enemy.members[1]!.name).toContain('#2');
  });
});

// ---------------------------------------------------------------------------
// startWar
// ---------------------------------------------------------------------------

describe('startWar', () => {
  it('creates a war state in the preparation phase', () => {
    const war = startWar('My Clan', [8, 7, 6, 5, 4], 5);

    expect(war.phase).toBe('preparation');
  });

  it('sorts player members by TH level descending', () => {
    const war = startWar('My Clan', [3, 10, 7, 5, 8], 5);

    const thLevels = war.playerClan.members.map((m) => m.townHallLevel);
    for (let i = 1; i < thLevels.length; i++) {
      expect(thLevels[i]!).toBeLessThanOrEqual(thLevels[i - 1]!);
    }
  });

  it('limits members to the requested war size', () => {
    const war = startWar('My Clan', [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 5);

    expect(war.playerClan.members).toHaveLength(5);
    expect(war.warSize).toBe(5);
  });

  it('uses available members when fewer than war size', () => {
    const war = startWar('My Clan', [10, 9, 8], 5);

    expect(war.playerClan.members).toHaveLength(3);
    expect(war.warSize).toBe(3);
  });

  it('defaults to 5v5 when given an invalid war size', () => {
    const war = startWar('My Clan', [10, 9, 8, 7, 6], 99);

    expect(war.warSize).toBeLessThanOrEqual(5);
  });

  it('sets preparation and battle time remaining', () => {
    const war = startWar('My Clan', [8], 5);

    expect(war.preparationTimeRemaining).toBe(86400);
    expect(war.battleTimeRemaining).toBe(86400);
  });

  it('sets the player clan name correctly', () => {
    const war = startWar('Dragon Riders', [8, 7], 5);

    expect(war.playerClan.name).toBe('Dragon Riders');
  });

  it('generates an enemy clan that mirrors the player clan size', () => {
    const war = startWar('My Clan', [10, 9, 8, 7, 6], 5);

    expect(war.enemyClan.members).toHaveLength(war.playerClan.members.length);
  });

  it('gives each player member 2 attacks remaining', () => {
    const war = startWar('My Clan', [8, 7, 6], 5);

    for (const member of war.playerClan.members) {
      expect(member.attacksRemaining).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// startBattlePhase
// ---------------------------------------------------------------------------

describe('startBattlePhase', () => {
  it('transitions the war from preparation to battle phase', () => {
    const war = makeWarState({ phase: 'preparation', preparationTimeRemaining: 5000 });
    const result = startBattlePhase(war);

    expect(result.phase).toBe('battle');
  });

  it('sets preparation time remaining to 0', () => {
    const war = makeWarState({ phase: 'preparation', preparationTimeRemaining: 5000 });
    const result = startBattlePhase(war);

    expect(result.preparationTimeRemaining).toBe(0);
  });

  it('returns the same state if not in preparation phase (battle)', () => {
    const war = makeWarState({ phase: 'battle' });
    const result = startBattlePhase(war);

    expect(result).toBe(war);
  });

  it('returns the same state if not in preparation phase (ended)', () => {
    const war = makeWarState({ phase: 'ended' });
    const result = startBattlePhase(war);

    expect(result).toBe(war);
  });

  it('does not mutate the original war state', () => {
    const war = makeWarState({ phase: 'preparation', preparationTimeRemaining: 5000 });
    startBattlePhase(war);

    expect(war.phase).toBe('preparation');
    expect(war.preparationTimeRemaining).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// recordPlayerAttack
// ---------------------------------------------------------------------------

describe('recordPlayerAttack', () => {
  it('decrements the attacker attacks remaining by 1', () => {
    const members = [makeMember({ attacksRemaining: 2 }), makeMember()];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: [makeMember(), makeMember()] }),
    });
    const result = recordPlayerAttack(war, 0, 1, 2, 60);

    expect(result.playerClan.members[0]!.attacksRemaining).toBe(1);
  });

  it('only counts star improvements over the best existing attack on the same defender', () => {
    const playerMembers = [
      makeMember({ attacksRemaining: 2 }),
      makeMember({ bestAttackStars: 1, bestAttackDestruction: 40 }),
    ];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers, totalStars: 1 }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: [makeMember(), makeMember()] }),
    });
    // Attack defender index 1 who already has 1 star best; new attack gets 2 stars
    const result = recordPlayerAttack(war, 0, 1, 2, 65);

    // Only 1 new star should be added (2 - 1 = 1)
    expect(result.playerClan.totalStars).toBe(2);
  });

  it('does not add stars when the new attack does not improve on existing best', () => {
    const playerMembers = [
      makeMember({ attacksRemaining: 2 }),
      makeMember({ bestAttackStars: 3, bestAttackDestruction: 100 }),
    ];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers, totalStars: 3 }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: [makeMember(), makeMember()] }),
    });
    // Attack defender index 1 who already has 3 stars; new attack only gets 1 star
    const result = recordPlayerAttack(war, 0, 1, 1, 30);

    expect(result.playerClan.totalStars).toBe(3);
  });

  it('updates the total stars on the player clan', () => {
    const playerMembers = [makeMember({ attacksRemaining: 2 }), makeMember()];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers, totalStars: 0 }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: [makeMember(), makeMember()] }),
    });
    const result = recordPlayerAttack(war, 0, 1, 3, 100);

    expect(result.playerClan.totalStars).toBe(3);
  });

  it('returns unchanged state when attacker has no attacks remaining', () => {
    const playerMembers = [makeMember({ attacksRemaining: 0 }), makeMember()];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: [makeMember(), makeMember()] }),
    });
    const result = recordPlayerAttack(war, 0, 1, 3, 100);

    expect(result).toBe(war);
  });

  it('returns unchanged state when not in battle phase', () => {
    const war = makeWarState({ phase: 'preparation' });
    const result = recordPlayerAttack(war, 0, 0, 3, 100);

    expect(result).toBe(war);
  });

  it('returns unchanged state when phase is ended', () => {
    const war = makeWarState({ phase: 'ended' });
    const result = recordPlayerAttack(war, 0, 0, 3, 100);

    expect(result).toBe(war);
  });

  it('does not mutate the original war state', () => {
    const playerMembers = [makeMember({ attacksRemaining: 2 }), makeMember()];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: [makeMember(), makeMember()] }),
    });
    const originalAttacksRemaining = war.playerClan.members[0]!.attacksRemaining;
    const originalTotalStars = war.playerClan.totalStars;
    recordPlayerAttack(war, 0, 1, 3, 100);

    expect(war.playerClan.members[0]!.attacksRemaining).toBe(originalAttacksRemaining);
    expect(war.playerClan.totalStars).toBe(originalTotalStars);
  });
});

// ---------------------------------------------------------------------------
// simulateNPCAttacks
// ---------------------------------------------------------------------------

describe('simulateNPCAttacks', () => {
  it('sets all NPC member attacks remaining to 0', () => {
    const enemyMembers = [
      makeMember({ name: 'NPC #1', attacksRemaining: 2 }),
      makeMember({ name: 'NPC #2', attacksRemaining: 2 }),
    ];
    const playerMembers = [makeMember(), makeMember()];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: enemyMembers }),
    });
    const result = simulateNPCAttacks(war);

    for (const member of result.enemyClan.members) {
      expect(member.attacksRemaining).toBe(0);
    }
  });

  it('generates stars between 0 and 3 for each NPC member', () => {
    const enemyMembers = Array.from({ length: 5 }, (_, i) =>
      makeMember({ name: `NPC #${i + 1}`, attacksRemaining: 2 }),
    );
    const playerMembers = Array.from({ length: 5 }, () => makeMember());
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: enemyMembers }),
    });
    const result = simulateNPCAttacks(war);

    for (const member of result.enemyClan.members) {
      expect(member.bestAttackStars).toBeGreaterThanOrEqual(0);
      expect(member.bestAttackStars).toBeLessThanOrEqual(3);
    }
  });

  it('sets total stars on the enemy clan after simulation', () => {
    const enemyMembers = [makeMember({ attacksRemaining: 2 })];
    const playerMembers = [makeMember()];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: enemyMembers, totalStars: 0 }),
    });
    const result = simulateNPCAttacks(war);

    expect(result.enemyClan.totalStars).toBeGreaterThanOrEqual(0);
    expect(result.enemyClan.totalStars).toBeLessThanOrEqual(3);
  });

  it('returns unchanged state when not in battle phase', () => {
    const war = makeWarState({ phase: 'preparation' });
    const result = simulateNPCAttacks(war);

    expect(result).toBe(war);
  });

  it('does not mutate the original war state', () => {
    const enemyMembers = [makeMember({ attacksRemaining: 2 })];
    const playerMembers = [makeMember()];
    const war = makeWarState({
      playerClan: makeClan({ name: 'Player Clan', members: playerMembers }),
      enemyClan: makeClan({ name: 'Enemy Clan', members: enemyMembers }),
    });
    const originalAttacksRemaining = war.enemyClan.members[0]!.attacksRemaining;
    simulateNPCAttacks(war);

    expect(war.enemyClan.members[0]!.attacksRemaining).toBe(originalAttacksRemaining);
  });
});

// ---------------------------------------------------------------------------
// endWar
// ---------------------------------------------------------------------------

describe('endWar', () => {
  it('sets the phase to ended', () => {
    const war = makeWarState({ phase: 'battle' });
    const { war: endedWar } = endWar(war);

    expect(endedWar.phase).toBe('ended');
  });

  it('sets battle time remaining to 0', () => {
    const war = makeWarState({ battleTimeRemaining: 5000 });
    const { war: endedWar } = endWar(war);

    expect(endedWar.battleTimeRemaining).toBe(0);
  });

  it('returns victory when player has more stars', () => {
    const war = makeWarState({
      playerClan: makeClan({ totalStars: 10, totalDestruction: 50 }),
      enemyClan: makeClan({ totalStars: 5, totalDestruction: 30 }),
    });
    const { result } = endWar(war);

    expect(result).toBe('victory');
  });

  it('returns defeat when enemy has more stars', () => {
    const war = makeWarState({
      playerClan: makeClan({ totalStars: 3, totalDestruction: 30 }),
      enemyClan: makeClan({ totalStars: 8, totalDestruction: 60 }),
    });
    const { result } = endWar(war);

    expect(result).toBe('defeat');
  });

  it('uses destruction as tiebreaker when stars are equal, player wins', () => {
    const war = makeWarState({
      playerClan: makeClan({ totalStars: 5, totalDestruction: 80 }),
      enemyClan: makeClan({ totalStars: 5, totalDestruction: 60 }),
    });
    const { result } = endWar(war);

    expect(result).toBe('victory');
  });

  it('uses destruction as tiebreaker when stars are equal, enemy wins', () => {
    const war = makeWarState({
      playerClan: makeClan({ totalStars: 5, totalDestruction: 40 }),
      enemyClan: makeClan({ totalStars: 5, totalDestruction: 70 }),
    });
    const { result } = endWar(war);

    expect(result).toBe('defeat');
  });

  it('returns draw when both stars and destruction are equal', () => {
    const war = makeWarState({
      playerClan: makeClan({ totalStars: 5, totalDestruction: 50 }),
      enemyClan: makeClan({ totalStars: 5, totalDestruction: 50 }),
    });
    const { result } = endWar(war);

    expect(result).toBe('draw');
  });

  it('does not mutate the original war state', () => {
    const war = makeWarState({ phase: 'battle', battleTimeRemaining: 5000 });
    endWar(war);

    expect(war.phase).toBe('battle');
    expect(war.battleTimeRemaining).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// calculateWarLoot
// ---------------------------------------------------------------------------

describe('calculateWarLoot', () => {
  it('returns gold and elixir based on TH level', () => {
    const loot = calculateWarLoot('victory', 8);

    expect(loot.gold).toBe(400000);
    expect(loot.elixir).toBe(400000);
  });

  it('victory gives more loot than defeat', () => {
    const victoryLoot = calculateWarLoot('victory', 10);
    const defeatLoot = calculateWarLoot('defeat', 10);

    expect(victoryLoot.gold).toBeGreaterThan(defeatLoot.gold);
    expect(victoryLoot.elixir).toBeGreaterThan(defeatLoot.elixir);
  });

  it('draw gives more loot than defeat but less than victory', () => {
    const victoryLoot = calculateWarLoot('victory', 10);
    const drawLoot = calculateWarLoot('draw', 10);
    const defeatLoot = calculateWarLoot('defeat', 10);

    expect(drawLoot.gold).toBeGreaterThan(defeatLoot.gold);
    expect(drawLoot.gold).toBeLessThan(victoryLoot.gold);
  });

  it('includes dark elixir for TH level 7 and above', () => {
    const loot = calculateWarLoot('victory', 7);

    expect(loot.darkElixir).toBeGreaterThan(0);
  });

  it('does not include dark elixir for TH level below 7', () => {
    const loot = calculateWarLoot('victory', 6);

    expect(loot.darkElixir).toBe(0);
  });

  it('scales loot with TH level', () => {
    const lootTH5 = calculateWarLoot('victory', 5);
    const lootTH10 = calculateWarLoot('victory', 10);

    expect(lootTH10.gold).toBeGreaterThan(lootTH5.gold);
    expect(lootTH10.elixir).toBeGreaterThan(lootTH5.elixir);
  });

  it('returns whole numbers for all loot values', () => {
    const loot = calculateWarLoot('draw', 9);

    expect(Number.isInteger(loot.gold)).toBe(true);
    expect(Number.isInteger(loot.elixir)).toBe(true);
    expect(Number.isInteger(loot.darkElixir)).toBe(true);
  });

  it('calculates defeat loot at 20% of base', () => {
    const loot = calculateWarLoot('defeat', 10);

    // baseLoot = 10 * 50000 = 500000; defeat multiplier = 0.2
    expect(loot.gold).toBe(100000);
    expect(loot.elixir).toBe(100000);
  });
});
