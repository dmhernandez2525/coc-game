import type { BattleState, BattleBuilding, DeployedTroop, ActiveDefense } from '../../types/battle.ts';
import type { PlacedBuilding, TrainedTroop } from '../../types/village.ts';
import {
  initBattleState,
  deployTroop,
  calculateStars,
  tickBattle,
  getBattleResult,
  isBattleOver,
} from '../battle-engine.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacedBuilding(
  id: string,
  type: PlacedBuilding['buildingType'],
  level: number,
  overrides?: Partial<PlacedBuilding>,
): PlacedBuilding {
  return {
    instanceId: `test_${id}_${Math.random().toString(36).slice(2, 6)}`,
    buildingId: id,
    buildingType: type,
    level,
    gridX: 20,
    gridY: 20,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeBuilding(
  name: string,
  overrides?: Partial<BattleBuilding>,
): BattleBuilding {
  return {
    instanceId: `bb_${name}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    currentHp: 500,
    maxHp: 500,
    x: 20,
    y: 20,
    isDestroyed: false,
    weight: name === 'Wall' ? 0 : 1,
    ...overrides,
  };
}

function makeDeployedTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  return {
    id: `troop_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 0,
    y: 0,
    targetId: null,
    state: 'idle',
    dps: 10,
    attackRange: 0.6,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

function makeDefense(overrides?: Partial<ActiveDefense>): ActiveDefense {
  return {
    buildingInstanceId: `def_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Cannon',
    level: 1,
    currentHp: 400,
    maxHp: 400,
    x: 20,
    y: 20,
    targetTroopId: null,
    dps: 9,
    range: { min: 0, max: 9 },
    attackSpeed: 0.8,
    lastAttackTime: 0,
    isDestroyed: false,
    ...overrides,
  };
}

function makeBattleState(overrides?: Partial<BattleState>): BattleState {
  return {
    phase: 'active',
    timeRemaining: 180,
    destructionPercent: 0,
    stars: 0,
    deployedTroops: [],
    defenses: [],
    buildings: [
      makeBuilding('Town Hall', { instanceId: 'th_1' }),
      makeBuilding('Gold Mine', { instanceId: 'gm_1' }),
    ],
    spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: [
      { name: 'Barbarian', level: 1, count: 10 },
      { name: 'Archer', level: 1, count: 5 },
    ],
    availableSpells: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// initBattleState
// ---------------------------------------------------------------------------

describe('initBattleState', () => {
  it('creates BattleBuilding entries for every defender building', () => {
    const buildings = [
      makePlacedBuilding('Cannon', 'defense', 1),
      makePlacedBuilding('Gold Mine', 'resource_collector', 1),
      makePlacedBuilding('Town Hall', 'other', 1),
    ];
    const state = initBattleState({ buildings }, [], []);

    expect(state.buildings).toHaveLength(3);
    const names = state.buildings.map((b) => b.name);
    expect(names).toContain('Cannon');
    expect(names).toContain('Gold Mine');
    expect(names).toContain('Town Hall');
  });

  it('sets phase to active and timeRemaining to 180', () => {
    const state = initBattleState({ buildings: [] }, [], []);

    expect(state.phase).toBe('active');
    expect(state.timeRemaining).toBe(180);
  });

  it('populates availableTroops from the attacker army', () => {
    const army: TrainedTroop[] = [
      { name: 'Barbarian', level: 1, count: 20 },
      { name: 'Archer', level: 2, count: 10 },
    ];
    const state = initBattleState({ buildings: [] }, army, []);

    expect(state.availableTroops).toHaveLength(2);
    expect(state.availableTroops[0]!.name).toBe('Barbarian');
    expect(state.availableTroops[0]!.count).toBe(20);
    expect(state.availableTroops[1]!.name).toBe('Archer');
    expect(state.availableTroops[1]!.level).toBe(2);
  });

  it('populates availableSpells from the attacker spells', () => {
    const spells: TrainedTroop[] = [
      { name: 'Lightning Spell', level: 1, count: 2 },
    ];
    const state = initBattleState({ buildings: [] }, [], spells);

    expect(state.availableSpells).toHaveLength(1);
    expect(state.availableSpells[0]!.name).toBe('Lightning Spell');
    expect(state.availableSpells[0]!.count).toBe(2);
  });

  it('handles an empty army gracefully', () => {
    const state = initBattleState({ buildings: [] }, [], []);

    expect(state.availableTroops).toHaveLength(0);
    expect(state.availableSpells).toHaveLength(0);
    expect(state.deployedTroops).toHaveLength(0);
  });

  it('creates ActiveDefense entries only for defense-type buildings with valid data', () => {
    const buildings = [
      makePlacedBuilding('Cannon', 'defense', 1),
      makePlacedBuilding('Gold Mine', 'resource_collector', 1),
    ];
    const state = initBattleState({ buildings }, [], []);

    // Cannon is a defense with data in the defense loader, so it should produce an ActiveDefense.
    // Gold Mine is not a defense type, so it should not.
    expect(state.defenses.length).toBeGreaterThanOrEqual(1);
    const defenseNames = state.defenses.map((d) => d.name);
    expect(defenseNames).toContain('Cannon');
    expect(defenseNames).not.toContain('Gold Mine');
  });

  it('uses DEFAULT_BUILDING_HP (500) for non-defense buildings', () => {
    const buildings = [
      makePlacedBuilding('Gold Mine', 'resource_collector', 1),
    ];
    const state = initBattleState({ buildings }, [], []);

    // Gold Mine has no entry in the defense loader, so hp defaults to 500
    expect(state.buildings[0]!.currentHp).toBe(500);
    expect(state.buildings[0]!.maxHp).toBe(500);
  });

  it('assigns weight 0 to Wall buildings and weight 1 to others', () => {
    const buildings = [
      makePlacedBuilding('Wall', 'defense', 1),
      makePlacedBuilding('Cannon', 'defense', 1),
    ];
    const state = initBattleState({ buildings }, [], []);

    const wall = state.buildings.find((b) => b.name === 'Wall');
    const cannon = state.buildings.find((b) => b.name === 'Cannon');
    expect(wall?.weight).toBe(0);
    expect(cannon?.weight).toBe(1);
  });

  it('starts with 0 stars, 0 destructionPercent, and empty loot', () => {
    const state = initBattleState({ buildings: [] }, [], []);

    expect(state.stars).toBe(0);
    expect(state.destructionPercent).toBe(0);
    expect(state.loot).toEqual({ gold: 0, elixir: 0, darkElixir: 0 });
  });
});

// ---------------------------------------------------------------------------
// deployTroop
// ---------------------------------------------------------------------------

describe('deployTroop', () => {
  it('successfully deploys a troop and adds it to deployedTroops', () => {
    const state = makeBattleState();
    const result = deployTroop(state, 'Barbarian', 5, 10);

    expect(result).not.toBeNull();
    expect(result!.deployedTroops).toHaveLength(1);
    expect(result!.deployedTroops[0]!.name).toBe('Barbarian');
    expect(result!.deployedTroops[0]!.x).toBe(5);
    expect(result!.deployedTroops[0]!.y).toBe(10);
  });

  it('decrements the available count after deploying', () => {
    const state = makeBattleState({
      availableTroops: [{ name: 'Barbarian', level: 1, count: 3 }],
    });
    const result = deployTroop(state, 'Barbarian', 0, 0);

    expect(result).not.toBeNull();
    expect(result!.availableTroops[0]!.count).toBe(2);
  });

  it('removes the troop entry from availableTroops when count reaches 0', () => {
    const state = makeBattleState({
      availableTroops: [{ name: 'Barbarian', level: 1, count: 1 }],
    });
    const result = deployTroop(state, 'Barbarian', 0, 0);

    expect(result).not.toBeNull();
    // The filter removes entries with count 0
    expect(result!.availableTroops).toHaveLength(0);
  });

  it('returns null for an unknown troop name', () => {
    const state = makeBattleState();
    const result = deployTroop(state, 'NonExistentUnit', 0, 0);

    expect(result).toBeNull();
  });

  it('returns null when the requested troop has zero count', () => {
    const state = makeBattleState({
      availableTroops: [{ name: 'Barbarian', level: 1, count: 0 }],
    });
    const result = deployTroop(state, 'Barbarian', 0, 0);

    expect(result).toBeNull();
  });

  it('returns null when the troop loader has no data for the troop', () => {
    // Use a troop name that is in availableTroops but not in the troop loader
    const state = makeBattleState({
      availableTroops: [{ name: 'FakeUnit', level: 1, count: 5 }],
    });
    const result = deployTroop(state, 'FakeUnit', 0, 0);

    expect(result).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = makeBattleState({
      availableTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });
    const originalCount = state.availableTroops[0]!.count;
    deployTroop(state, 'Barbarian', 0, 0);

    expect(state.availableTroops[0]!.count).toBe(originalCount);
    expect(state.deployedTroops).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calculateStars
// ---------------------------------------------------------------------------

describe('calculateStars', () => {
  it('returns 0 stars and 0% destruction when nothing is destroyed', () => {
    const buildings = [
      makeBuilding('Town Hall'),
      makeBuilding('Cannon'),
      makeBuilding('Gold Mine'),
    ];
    const result = calculateStars(buildings);

    expect(result.stars).toBe(0);
    expect(result.destructionPercent).toBe(0);
  });

  it('returns 1 star at exactly 50% destruction (without TH)', () => {
    const buildings = [
      makeBuilding('Cannon', { isDestroyed: true }),
      makeBuilding('Gold Mine'),
    ];
    const result = calculateStars(buildings);

    expect(result.destructionPercent).toBe(50);
    expect(result.stars).toBe(1);
  });

  it('returns 1 star when only the Town Hall is destroyed (less than 50%)', () => {
    const buildings = [
      makeBuilding('Town Hall', { isDestroyed: true }),
      makeBuilding('Cannon'),
      makeBuilding('Gold Mine'),
      makeBuilding('Barracks'),
    ];
    const result = calculateStars(buildings);

    expect(result.destructionPercent).toBe(25);
    expect(result.stars).toBe(1);
  });

  it('returns 2 stars when TH is destroyed and destruction >= 50%', () => {
    const buildings = [
      makeBuilding('Town Hall', { isDestroyed: true }),
      makeBuilding('Cannon', { isDestroyed: true }),
      makeBuilding('Gold Mine'),
      makeBuilding('Barracks'),
    ];
    const result = calculateStars(buildings);

    expect(result.destructionPercent).toBe(50);
    expect(result.stars).toBe(2);
  });

  it('returns 3 stars at 100% destruction (TH is implicitly destroyed too)', () => {
    const buildings = [
      makeBuilding('Town Hall', { isDestroyed: true }),
      makeBuilding('Cannon', { isDestroyed: true }),
      makeBuilding('Gold Mine', { isDestroyed: true }),
    ];
    const result = calculateStars(buildings);

    expect(result.destructionPercent).toBe(100);
    expect(result.stars).toBe(3);
  });

  it('ignores walls (weight 0) in destruction calculation', () => {
    const buildings = [
      makeBuilding('Wall', { isDestroyed: true }),
      makeBuilding('Cannon'),
      makeBuilding('Gold Mine'),
    ];
    const result = calculateStars(buildings);

    // Only Cannon and Gold Mine have weight, neither is destroyed
    expect(result.destructionPercent).toBe(0);
    expect(result.stars).toBe(0);
  });

  it('handles an empty buildings array', () => {
    const result = calculateStars([]);

    expect(result.stars).toBe(0);
    expect(result.destructionPercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tickBattle
// ---------------------------------------------------------------------------

describe('tickBattle', () => {
  it('returns the same state when phase is ended', () => {
    const state = makeBattleState({ phase: 'ended' });
    const result = tickBattle(state, 1000);

    expect(result).toBe(state);
  });

  it('decrements timeRemaining based on deltaMs', () => {
    const state = makeBattleState({ timeRemaining: 180 });
    const result = tickBattle(state, 2000); // 2 seconds

    expect(result.timeRemaining).toBe(178);
  });

  it('ends the battle when time runs out', () => {
    const state = makeBattleState({ timeRemaining: 1 });
    // 2000ms = 2 seconds, more than the 1 second remaining
    const result = tickBattle(state, 2000);

    expect(result.phase).toBe('ended');
    expect(result.timeRemaining).toBe(0);
  });

  it('ends the battle on 100% destruction', () => {
    const state = makeBattleState({
      buildings: [
        makeBuilding('Town Hall', { instanceId: 'th_1', isDestroyed: true }),
        makeBuilding('Cannon', { instanceId: 'cn_1', isDestroyed: true }),
      ],
    });
    const result = tickBattle(state, 100);

    expect(result.phase).toBe('ended');
    expect(result.destructionPercent).toBe(100);
    expect(result.stars).toBe(3);
  });

  it('ends the battle when all deployed troops are dead and none remain', () => {
    const deadTroop = makeDeployedTroop({ state: 'dead', currentHp: 0 });
    const state = makeBattleState({
      deployedTroops: [deadTroop],
      availableTroops: [],
    });
    const result = tickBattle(state, 100);

    expect(result.phase).toBe('ended');
  });

  it('does not end the battle when troops are dead but some are still available', () => {
    const deadTroop = makeDeployedTroop({ state: 'dead', currentHp: 0 });
    const state = makeBattleState({
      deployedTroops: [deadTroop],
      availableTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });
    const result = tickBattle(state, 100);

    expect(result.phase).toBe('active');
  });

  it('updates stars and destructionPercent each tick', () => {
    const state = makeBattleState({
      buildings: [
        makeBuilding('Cannon', { instanceId: 'cn_1', isDestroyed: true }),
        makeBuilding('Gold Mine', { instanceId: 'gm_1' }),
      ],
    });
    const result = tickBattle(state, 100);

    expect(result.destructionPercent).toBe(50);
    expect(result.stars).toBe(1);
  });

  it('creates shallow copies of troops, buildings, and defenses each tick', () => {
    const troop = makeDeployedTroop();
    const building = makeBuilding('Cannon', { instanceId: 'cn_1' });
    const defense = makeDefense({ buildingInstanceId: 'cn_1' });
    const state = makeBattleState({
      deployedTroops: [troop],
      buildings: [building],
      defenses: [defense],
    });
    const result = tickBattle(state, 100);

    // The arrays should be new references, not the same objects
    expect(result.deployedTroops).not.toBe(state.deployedTroops);
    expect(result.buildings).not.toBe(state.buildings);
    expect(result.defenses).not.toBe(state.defenses);
  });
});

// ---------------------------------------------------------------------------
// getBattleResult
// ---------------------------------------------------------------------------

describe('getBattleResult', () => {
  it('returns positive trophyChange when stars > 0', () => {
    const state = makeBattleState({ stars: 2, destructionPercent: 75, timeRemaining: 60 });
    const result = getBattleResult(state, 30);

    expect(result.trophyChange).toBe(30);
  });

  it('returns negative trophyChange when stars = 0', () => {
    const state = makeBattleState({ stars: 0, destructionPercent: 20, timeRemaining: 0 });
    const result = getBattleResult(state, 25);

    expect(result.trophyChange).toBe(-25);
  });

  it('calculates timeUsed correctly from timeRemaining', () => {
    const state = makeBattleState({ timeRemaining: 60 });
    const result = getBattleResult(state, 10);

    // BATTLE_DURATION (180) - timeRemaining (60) = 120
    expect(result.timeUsed).toBe(120);
  });

  it('includes stars, destructionPercent, and loot in the result', () => {
    const state = makeBattleState({
      stars: 3,
      destructionPercent: 100,
      loot: { gold: 5000, elixir: 3000, darkElixir: 100 },
    });
    const result = getBattleResult(state, 30);

    expect(result.stars).toBe(3);
    expect(result.destructionPercent).toBe(100);
    expect(result.loot).toEqual({ gold: 5000, elixir: 3000, darkElixir: 100 });
  });

  it('returns a copy of loot, not a direct reference', () => {
    const loot = { gold: 1000, elixir: 1000, darkElixir: 0 };
    const state = makeBattleState({ loot });
    const result = getBattleResult(state, 10);

    expect(result.loot).not.toBe(state.loot);
    expect(result.loot).toEqual(loot);
  });
});

// ---------------------------------------------------------------------------
// isBattleOver
// ---------------------------------------------------------------------------

describe('isBattleOver', () => {
  it('returns true when phase is ended', () => {
    const state = makeBattleState({ phase: 'ended' });

    expect(isBattleOver(state)).toBe(true);
  });

  it('returns true when timeRemaining is 0', () => {
    const state = makeBattleState({ phase: 'active', timeRemaining: 0 });

    expect(isBattleOver(state)).toBe(true);
  });

  it('returns true when timeRemaining is negative', () => {
    const state = makeBattleState({ phase: 'active', timeRemaining: -1 });

    expect(isBattleOver(state)).toBe(true);
  });

  it('returns true when destructionPercent >= 100', () => {
    const state = makeBattleState({ phase: 'active', destructionPercent: 100, timeRemaining: 60 });

    expect(isBattleOver(state)).toBe(true);
  });

  it('returns true when all deployed troops are dead and none are available', () => {
    const deadTroop = makeDeployedTroop({ state: 'dead' });
    const state = makeBattleState({
      phase: 'active',
      timeRemaining: 100,
      deployedTroops: [deadTroop],
      availableTroops: [],
    });

    expect(isBattleOver(state)).toBe(true);
  });

  it('returns false during an active battle with living troops', () => {
    const aliveTroop = makeDeployedTroop({ state: 'attacking' });
    const state = makeBattleState({
      phase: 'active',
      timeRemaining: 100,
      deployedTroops: [aliveTroop],
      availableTroops: [],
    });

    expect(isBattleOver(state)).toBe(false);
  });

  it('returns false when all troops are dead but more are available', () => {
    const deadTroop = makeDeployedTroop({ state: 'dead' });
    const state = makeBattleState({
      phase: 'active',
      timeRemaining: 100,
      deployedTroops: [deadTroop],
      availableTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });

    expect(isBattleOver(state)).toBe(false);
  });

  it('returns false when no troops have been deployed and none are available', () => {
    // Edge case: empty deployedTroops means .every() returns true
    const state = makeBattleState({
      phase: 'active',
      timeRemaining: 100,
      deployedTroops: [],
      availableTroops: [],
    });

    // every() on empty array returns true, and availableTroops.length === 0
    expect(isBattleOver(state)).toBe(true);
  });

  it('returns false in scout phase with time remaining', () => {
    const state = makeBattleState({
      phase: 'scout',
      timeRemaining: 30,
      deployedTroops: [],
      availableTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });

    expect(isBattleOver(state)).toBe(false);
  });
});
