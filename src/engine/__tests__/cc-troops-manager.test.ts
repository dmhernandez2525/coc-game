import type { ClanState } from '../clan-manager.ts';
import type { BattleState, DeployedTroop } from '../../types/battle.ts';
import {
  autoFillCastleTroops,
  shouldDeployDefensiveCC,
  deployDefensiveCCTroops,
  deployOffensiveCCTroops,
  getCCTroopHousing,
} from '../cc-troops-manager.ts';
import type { CCDeployConfig } from '../cc-troops-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClan(overrides?: Partial<ClanState>): ClanState {
  return {
    name: 'Test Clan',
    level: 1,
    xp: 0,
    badgeIndex: 0,
    castleTroops: [],
    ...overrides,
  };
}

function makeBattleState(
  deployedTroops: DeployedTroop[] = [],
): BattleState {
  return {
    phase: 'active',
    timeRemaining: 180,
    destructionPercent: 0,
    stars: 0,
    deployedTroops,
    defenses: [],
    buildings: [],
    spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: [],
    availableSpells: [],
  };
}

function makeTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  return {
    id: 'troop_1',
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 20,
    y: 20,
    targetId: null,
    state: 'idle',
    dps: 10,
    baseDps: 10,
    attackRange: 1,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// autoFillCastleTroops
// ---------------------------------------------------------------------------
describe('autoFillCastleTroops', () => {
  it('fills castle troops for TH3 (capacity 10, should get Archers)', () => {
    const clan = makeClan();
    const result = autoFillCastleTroops(clan, 3);

    expect(result.castleTroops.length).toBeGreaterThan(0);
    // TH3 pick is Archer level 2, maxCount 5; Archer housingSpace = 1
    // capacity = 10, so up to 5 Archers fit (5 * 1 = 5)
    const archerEntry = result.castleTroops.find((t) => t.name === 'Archer');
    expect(archerEntry).toBeDefined();
    expect(archerEntry!.level).toBe(2);
    expect(archerEntry!.count).toBeLessThanOrEqual(5);
  });

  it('returns unchanged clan for TH1 (capacity 0)', () => {
    const clan = makeClan();
    const result = autoFillCastleTroops(clan, 1);

    expect(result).toBe(clan);
    expect(result.castleTroops).toEqual([]);
  });

  it('returns unchanged clan for TH2 (capacity 0)', () => {
    const clan = makeClan();
    const result = autoFillCastleTroops(clan, 2);

    expect(result).toBe(clan);
    expect(result.castleTroops).toEqual([]);
  });

  it('fills different troops for TH7 (Dragon + Wizard)', () => {
    const clan = makeClan();
    const result = autoFillCastleTroops(clan, 7);

    // TH7 capacity = 20, picks: Dragon (level 1, maxCount 1, housing 20)
    // Dragon housing = 20, exactly fills capacity
    expect(result.castleTroops.length).toBeGreaterThan(0);
    const troopNames = result.castleTroops.map((t) => t.name);
    expect(troopNames).toContain('Dragon');
  });

  it('fills troops for TH4 (Wizard + Archer)', () => {
    const clan = makeClan();
    const result = autoFillCastleTroops(clan, 4);

    // TH4 capacity = 15, picks: Wizard (level 1, maxCount 2, housing 4), Archer (level 3, maxCount 5, housing 1)
    // 2 Wizards = 8, then 5 Archers = 5, total = 13 (within 15)
    expect(result.castleTroops.length).toBeGreaterThan(0);
    const troopNames = result.castleTroops.map((t) => t.name);
    expect(troopNames).toContain('Wizard');
  });

  it('does not mutate the original clan state', () => {
    const clan = makeClan();
    const originalTroops = [...clan.castleTroops];
    autoFillCastleTroops(clan, 5);

    expect(clan.castleTroops).toEqual(originalTroops);
  });

  it('replaces existing castle troops with new auto-fill selection', () => {
    const clan = makeClan({
      castleTroops: [{ name: 'Barbarian', level: 1, count: 3 }],
    });
    const result = autoFillCastleTroops(clan, 3);

    // autoFill always overwrites castleTroops
    const names = result.castleTroops.map((t) => t.name);
    expect(names).toContain('Archer');
  });

  it('does not exceed castle capacity', () => {
    const clan = makeClan();
    const result = autoFillCastleTroops(clan, 3);

    // TH3 capacity = 10; sum of all troops should not exceed 10
    let totalHousing = 0;
    for (const entry of result.castleTroops) {
      // Archer housing = 1
      if (entry.name === 'Archer') totalHousing += entry.count * 1;
    }
    expect(totalHousing).toBeLessThanOrEqual(10);
  });

  it('uses the closest lower TH config for TH levels without a specific config', () => {
    // TH11 has no explicit config in the picks table; it should use TH10 picks
    const clan = makeClan();
    const result = autoFillCastleTroops(clan, 11);

    // TH10 pick: Electro Dragon (housing 30, maxCount 1) + Wizard (housing 4, maxCount 2)
    // TH11 capacity = 35, Electro Dragon = 30, leaves 5 for 1 Wizard (4)
    const troopNames = result.castleTroops.map((t) => t.name);
    expect(troopNames).toContain('Electro Dragon');
  });
});

// ---------------------------------------------------------------------------
// shouldDeployDefensiveCC
// ---------------------------------------------------------------------------
describe('shouldDeployDefensiveCC', () => {
  const ccX = 20;
  const ccY = 20;

  it('returns true when a troop is within aggro radius', () => {
    const troop = makeTroop({ x: 25, y: 20, state: 'moving' });
    const state = makeBattleState([troop]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY);

    expect(result).toBe(true);
  });

  it('returns false when all troops are out of range', () => {
    const troop = makeTroop({ x: 100, y: 100, state: 'moving' });
    const state = makeBattleState([troop]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY);

    expect(result).toBe(false);
  });

  it('ignores dead troops', () => {
    const deadTroop = makeTroop({ x: 21, y: 20, state: 'dead' });
    const state = makeBattleState([deadTroop]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY);

    expect(result).toBe(false);
  });

  it('returns true if at least one alive troop is in range among many', () => {
    const farTroop = makeTroop({ id: 'far', x: 100, y: 100, state: 'moving' });
    const deadTroop = makeTroop({ id: 'dead', x: 21, y: 20, state: 'dead' });
    const closeTroop = makeTroop({ id: 'close', x: 22, y: 20, state: 'attacking' });
    const state = makeBattleState([farTroop, deadTroop, closeTroop]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY);

    expect(result).toBe(true);
  });

  it('returns false when there are no deployed troops', () => {
    const state = makeBattleState([]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY);

    expect(result).toBe(false);
  });

  it('uses the default aggro radius of 12 tiles', () => {
    // Exactly 12 tiles away should be in range
    const troop = makeTroop({ x: ccX + 12, y: ccY, state: 'idle' });
    const state = makeBattleState([troop]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY);

    expect(result).toBe(true);
  });

  it('returns false when troop is just beyond default aggro radius', () => {
    // Just over 12 tiles away
    const troop = makeTroop({ x: ccX + 13, y: ccY, state: 'idle' });
    const state = makeBattleState([troop]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY);

    expect(result).toBe(false);
  });

  it('respects a custom config aggro radius', () => {
    const config: CCDeployConfig = { aggroRadius: 5, deployOffsetRange: 2 };
    const troop = makeTroop({ x: ccX + 6, y: ccY, state: 'idle' });
    const state = makeBattleState([troop]);

    const result = shouldDeployDefensiveCC(state, ccX, ccY, config);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deployDefensiveCCTroops
// ---------------------------------------------------------------------------
describe('deployDefensiveCCTroops', () => {
  const ccX = 20;
  const ccY = 20;

  it('creates the correct number of deployed troops', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 2, count: 3 },
    ];
    const deployed = deployDefensiveCCTroops(castleTroops, ccX, ccY);

    expect(deployed).toHaveLength(3);
  });

  it('sets correct stats from troop data for Archers', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 2, count: 1 },
    ];
    const deployed = deployDefensiveCCTroops(castleTroops, ccX, ccY);

    expect(deployed).toHaveLength(1);
    const troop = deployed[0]!;
    // Archer level 2: dps = 9, hp = 23
    expect(troop.name).toBe('Archer');
    expect(troop.level).toBe(2);
    expect(troop.currentHp).toBe(23);
    expect(troop.maxHp).toBe(23);
    expect(troop.dps).toBe(9);
    expect(troop.baseDps).toBe(9);
    expect(troop.state).toBe('idle');
    expect(troop.targetId).toBeNull();
    expect(troop.isFlying).toBe(false);
    expect(troop.movementSpeed).toBe(24);
  });

  it('generates unique IDs with cc_def_ prefix', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 2, count: 3 },
    ];
    const deployed = deployDefensiveCCTroops(castleTroops, ccX, ccY);
    const ids = deployed.map((t) => t.id);

    // All IDs should start with cc_def_
    for (const id of ids) {
      expect(id).toMatch(/^cc_def_/);
    }

    // All IDs should be unique
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deploys multiple troop types correctly', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 1, count: 2 },
      { name: 'Wizard', level: 1, count: 1 },
    ];
    const deployed = deployDefensiveCCTroops(castleTroops, ccX, ccY);

    expect(deployed).toHaveLength(3);
    const archers = deployed.filter((t) => t.name === 'Archer');
    const wizards = deployed.filter((t) => t.name === 'Wizard');
    expect(archers).toHaveLength(2);
    expect(wizards).toHaveLength(1);
  });

  it('positions troops near the CC with random offsets', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 1, count: 5 },
    ];
    const config: CCDeployConfig = { aggroRadius: 12, deployOffsetRange: 2 };
    const deployed = deployDefensiveCCTroops(castleTroops, ccX, ccY, config);

    for (const troop of deployed) {
      // Offsets should be within deployOffsetRange (2 tiles)
      expect(troop.x).toBeGreaterThanOrEqual(ccX - 2);
      expect(troop.x).toBeLessThanOrEqual(ccX + 2);
      expect(troop.y).toBeGreaterThanOrEqual(ccY - 2);
      expect(troop.y).toBeLessThanOrEqual(ccY + 2);
    }
  });

  it('returns an empty array for empty castle troops', () => {
    const deployed = deployDefensiveCCTroops([], ccX, ccY);

    expect(deployed).toHaveLength(0);
  });

  it('skips unknown troop names gracefully', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'FakeTroop', level: 1, count: 3 },
    ];
    const deployed = deployDefensiveCCTroops(castleTroops, ccX, ccY);

    expect(deployed).toHaveLength(0);
  });

  it('sets attackRange to 1 for all CC troops', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 1, count: 2 },
    ];
    const deployed = deployDefensiveCCTroops(castleTroops, ccX, ccY);

    for (const troop of deployed) {
      expect(troop.attackRange).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// deployOffensiveCCTroops
// ---------------------------------------------------------------------------
describe('deployOffensiveCCTroops', () => {
  const deployX = 10;
  const deployY = 10;

  it('creates the correct number of deployed troops', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Wizard', level: 1, count: 2 },
    ];
    const deployed = deployOffensiveCCTroops(castleTroops, deployX, deployY);

    expect(deployed).toHaveLength(2);
  });

  it('generates unique IDs with cc_off_ prefix', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 1, count: 3 },
    ];
    const deployed = deployOffensiveCCTroops(castleTroops, deployX, deployY);
    const ids = deployed.map((t) => t.id);

    for (const id of ids) {
      expect(id).toMatch(/^cc_off_/);
    }

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sets correct stats from troop data for Wizards', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Wizard', level: 1, count: 1 },
    ];
    const deployed = deployOffensiveCCTroops(castleTroops, deployX, deployY);

    expect(deployed).toHaveLength(1);
    const troop = deployed[0]!;
    // Wizard level 1: dps = 50, hp = 75
    expect(troop.name).toBe('Wizard');
    expect(troop.level).toBe(1);
    expect(troop.currentHp).toBe(75);
    expect(troop.maxHp).toBe(75);
    expect(troop.dps).toBe(50);
    expect(troop.baseDps).toBe(50);
    expect(troop.state).toBe('idle');
    expect(troop.targetId).toBeNull();
    expect(troop.isFlying).toBe(false);
    expect(troop.movementSpeed).toBe(16);
  });

  it('positions troops near the deploy point with random offsets', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 1, count: 5 },
    ];
    const deployed = deployOffensiveCCTroops(castleTroops, deployX, deployY);

    for (const troop of deployed) {
      // Offensive uses offset range of 1.5 (Math.random() - 0.5) * 3
      expect(troop.x).toBeGreaterThanOrEqual(deployX - 1.5);
      expect(troop.x).toBeLessThanOrEqual(deployX + 1.5);
      expect(troop.y).toBeGreaterThanOrEqual(deployY - 1.5);
      expect(troop.y).toBeLessThanOrEqual(deployY + 1.5);
    }
  });

  it('returns an empty array for empty castle troops', () => {
    const deployed = deployOffensiveCCTroops([], deployX, deployY);

    expect(deployed).toHaveLength(0);
  });

  it('skips unknown troop names gracefully', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'NonExistentTroop', level: 1, count: 5 },
    ];
    const deployed = deployOffensiveCCTroops(castleTroops, deployX, deployY);

    expect(deployed).toHaveLength(0);
  });

  it('uses different ID prefix from defensive deployment', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 1, count: 1 },
    ];
    const defensive = deployDefensiveCCTroops(castleTroops, 20, 20);
    const offensive = deployOffensiveCCTroops(castleTroops, 10, 10);

    expect(defensive[0]!.id).toMatch(/^cc_def_/);
    expect(offensive[0]!.id).toMatch(/^cc_off_/);
  });

  it('falls back to level 1 stats when requested level is not found', () => {
    const castleTroops: ClanState['castleTroops'] = [
      { name: 'Archer', level: 999, count: 1 },
    ];
    const deployed = deployOffensiveCCTroops(castleTroops, deployX, deployY);

    // Should fall back to levels[0] (level 1) stats: hp = 20, dps = 7
    expect(deployed).toHaveLength(1);
    expect(deployed[0]!.currentHp).toBe(20);
    expect(deployed[0]!.maxHp).toBe(20);
    expect(deployed[0]!.dps).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// getCCTroopHousing
// ---------------------------------------------------------------------------
describe('getCCTroopHousing', () => {
  it('returns 0 for empty castle troops', () => {
    const housing = getCCTroopHousing([]);

    expect(housing).toBe(0);
  });

  it('calculates correctly for a single troop type', () => {
    // Archer housingSpace = 1, count = 5 => 5
    const housing = getCCTroopHousing([
      { name: 'Archer', level: 1, count: 5 },
    ]);

    expect(housing).toBe(5);
  });

  it('calculates correctly for multiple troop types', () => {
    // Archer (1) * 3 = 3, Wizard (4) * 2 = 8, total = 11
    const housing = getCCTroopHousing([
      { name: 'Archer', level: 1, count: 3 },
      { name: 'Wizard', level: 1, count: 2 },
    ]);

    expect(housing).toBe(11);
  });

  it('ignores unknown troop names', () => {
    const housing = getCCTroopHousing([
      { name: 'Archer', level: 1, count: 3 },
      { name: 'FakeTroop', level: 1, count: 10 },
    ]);

    // Only Archer counts: 3 * 1 = 3
    expect(housing).toBe(3);
  });

  it('handles a single high-housing troop correctly', () => {
    // Dragon housingSpace = 20, count = 1 => 20
    const housing = getCCTroopHousing([
      { name: 'Dragon', level: 1, count: 1 },
    ]);

    expect(housing).toBe(20);
  });
});
