import type { DeployedTroop, ActiveDefense, BattleBuilding } from '../../types/battle.ts';
import {
  distance,
  moveToward,
  findTroopTarget,
  findDefenseTarget,
} from '../targeting-ai.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let troopCounter = 0;
let buildingCounter = 0;
let defenseCounter = 0;

function makeTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  troopCounter += 1;
  return {
    id: `troop_${troopCounter}`,
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 0,
    y: 0,
    targetId: null,
    state: 'idle',
    dps: 10,
    attackRange: 1,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

function makeBuilding(overrides?: Partial<BattleBuilding>): BattleBuilding {
  buildingCounter += 1;
  return {
    instanceId: `bld_${buildingCounter}`,
    name: 'Barracks',
    currentHp: 500,
    maxHp: 500,
    x: 10,
    y: 10,
    isDestroyed: false,
    weight: 1,
    ...overrides,
  };
}

function makeDefense(overrides?: Partial<ActiveDefense>): ActiveDefense {
  defenseCounter += 1;
  return {
    buildingInstanceId: `def_${defenseCounter}`,
    name: 'Archer Tower',
    level: 1,
    currentHp: 300,
    maxHp: 300,
    x: 20,
    y: 20,
    targetTroopId: null,
    dps: 15,
    range: { min: 0, max: 10 },
    attackSpeed: 1,
    lastAttackTime: 0,
    isDestroyed: false,
    ...overrides,
  };
}

beforeEach(() => {
  troopCounter = 0;
  buildingCounter = 0;
  defenseCounter = 0;
});

// ---------------------------------------------------------------------------
// distance
// ---------------------------------------------------------------------------
describe('distance', () => {
  it('returns 0 for the same point', () => {
    expect(distance(5, 5, 5, 5)).toBe(0);
  });

  it('calculates horizontal distance correctly', () => {
    expect(distance(0, 0, 3, 0)).toBe(3);
  });

  it('calculates vertical distance correctly', () => {
    expect(distance(0, 0, 0, 4)).toBe(4);
  });

  it('calculates diagonal distance (3-4-5 triangle)', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  it('handles negative coordinates', () => {
    expect(distance(-3, -4, 0, 0)).toBe(5);
  });

  it('is symmetric (order of points does not matter)', () => {
    expect(distance(1, 2, 7, 9)).toBe(distance(7, 9, 1, 2));
  });
});

// ---------------------------------------------------------------------------
// moveToward
// ---------------------------------------------------------------------------
describe('moveToward', () => {
  it('moves in the correct direction over one second', () => {
    // speed=16 means 2 tiles/second (16/8). In 1000ms that is 2 tiles.
    const result = moveToward(0, 0, 10, 0, 16, 1000);
    expect(result.x).toBeCloseTo(2, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('snaps to target when remaining distance is within one step', () => {
    // speed=80, deltaMs=1000 => step = 80/8 * 1 = 10 tiles. Target is only 5 away.
    const result = moveToward(0, 0, 5, 0, 80, 1000);
    expect(result.x).toBe(5);
    expect(result.y).toBe(0);
  });

  it('returns same position when already at target (zero distance)', () => {
    const result = moveToward(7, 3, 7, 3, 16, 1000);
    expect(result.x).toBe(7);
    expect(result.y).toBe(3);
  });

  it('scales movement with deltaMs (half the time, half the distance)', () => {
    const full = moveToward(0, 0, 10, 0, 16, 1000);
    const half = moveToward(0, 0, 10, 0, 16, 500);
    expect(half.x).toBeCloseTo(full.x / 2, 5);
  });

  it('scales movement with speed (double speed, double distance)', () => {
    const normal = moveToward(0, 0, 100, 0, 16, 1000);
    const fast = moveToward(0, 0, 100, 0, 32, 1000);
    expect(fast.x).toBeCloseTo(normal.x * 2, 5);
  });

  it('moves diagonally toward the target', () => {
    // Target at (3, 4), distance = 5. speed=40 => step=5. Should snap.
    const result = moveToward(0, 0, 3, 4, 40, 1000);
    expect(result.x).toBe(3);
    expect(result.y).toBe(4);
  });

  it('moves partially along a diagonal when step is less than distance', () => {
    // Target at (30, 40), distance = 50. speed=8 => step = 1 tile/s * 1s = 1 tile.
    const result = moveToward(0, 0, 30, 40, 8, 1000);
    // ratio = 1/50, so x = 30/50 = 0.6, y = 40/50 = 0.8
    expect(result.x).toBeCloseTo(0.6, 5);
    expect(result.y).toBeCloseTo(0.8, 5);
  });
});

// ---------------------------------------------------------------------------
// findTroopTarget
// ---------------------------------------------------------------------------
describe('findTroopTarget', () => {
  it('returns the nearest building when no favorite target is set', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const close = makeBuilding({ x: 3, y: 4 }); // distance 5
    const far = makeBuilding({ x: 10, y: 10 }); // distance ~14.1

    const result = findTroopTarget(troop, [close, far], [], null);
    expect(result).toBe(close.instanceId);
  });

  it('returns null when all buildings and defenses are destroyed', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const b1 = makeBuilding({ isDestroyed: true });
    const d1 = makeDefense({ isDestroyed: true });

    const result = findTroopTarget(troop, [b1], [d1], null);
    expect(result).toBeNull();
  });

  it('returns null when there are no buildings or defenses', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const result = findTroopTarget(troop, [], [], null);
    expect(result).toBeNull();
  });

  it('targets nearest defense when favoriteTarget is "Defenses"', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const building = makeBuilding({ x: 1, y: 1 }); // closer, but not a defense
    const closeDef = makeDefense({ x: 3, y: 4 }); // distance 5
    const farDef = makeDefense({ x: 20, y: 20 }); // distance ~28.3

    const result = findTroopTarget(troop, [building], [closeDef, farDef], 'Defenses');
    expect(result).toBe(closeDef.buildingInstanceId);
  });

  it('falls back to nearest building when all defenses are destroyed', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const building = makeBuilding({ x: 5, y: 0 });
    const destroyedDef = makeDefense({ x: 1, y: 0, isDestroyed: true });

    const result = findTroopTarget(troop, [building], [destroyedDef], 'Defenses');
    expect(result).toBe(building.instanceId);
  });

  it('targets nearest resource building when favoriteTarget is "Resources"', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const barracks = makeBuilding({ name: 'Barracks', x: 1, y: 0 });
    const goldStorage = makeBuilding({ name: 'Gold Storage', x: 5, y: 0 });
    const elixirCollector = makeBuilding({ name: 'Elixir Collector', x: 10, y: 0 });

    const result = findTroopTarget(troop, [barracks, goldStorage, elixirCollector], [], 'Resources');
    expect(result).toBe(goldStorage.instanceId);
  });

  it('recognizes all resource keyword variations', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const mine = makeBuilding({ name: 'Gold Mine', x: 100, y: 0 });
    const drill = makeBuilding({ name: 'Dark Elixir Drill', x: 200, y: 0 });
    const th = makeBuilding({ name: 'Town Hall', x: 50, y: 0 });

    // Town Hall is closest resource-keyword building
    const result = findTroopTarget(troop, [mine, drill, th], [], 'Resources');
    expect(result).toBe(th.instanceId);
  });

  it('falls back to nearest building when all resources are destroyed', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const barracks = makeBuilding({ name: 'Barracks', x: 3, y: 0 });
    const storage = makeBuilding({ name: 'Gold Storage', x: 1, y: 0, isDestroyed: true });

    const result = findTroopTarget(troop, [barracks, storage], [], 'Resources');
    expect(result).toBe(barracks.instanceId);
  });

  it('targets nearest wall when favoriteTarget is "Walls"', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const barracks = makeBuilding({ name: 'Barracks', x: 1, y: 0 });
    const wall = makeBuilding({ name: 'Wall', x: 3, y: 0 });

    const result = findTroopTarget(troop, [barracks, wall], [], 'Walls');
    expect(result).toBe(wall.instanceId);
  });

  it('treats favoriteTarget "None" like no preference (nearest overall)', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const far = makeBuilding({ x: 100, y: 0 });
    const close = makeBuilding({ x: 2, y: 0 });

    const result = findTroopTarget(troop, [far, close], [], 'None');
    expect(result).toBe(close.instanceId);
  });

  it('treats favoriteTarget "Any Building" like no preference', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const far = makeBuilding({ x: 100, y: 0 });
    const close = makeBuilding({ x: 2, y: 0 });

    const result = findTroopTarget(troop, [far, close], [], 'Any Building');
    expect(result).toBe(close.instanceId);
  });

  it('includes defenses in the "all" pool for general targeting', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const building = makeBuilding({ x: 50, y: 50 });
    const defense = makeDefense({ x: 1, y: 0 });

    const result = findTroopTarget(troop, [building], [defense], null);
    expect(result).toBe(defense.buildingInstanceId);
  });

  it('skips destroyed buildings and picks the next nearest', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const destroyed = makeBuilding({ x: 1, y: 0, isDestroyed: true });
    const alive = makeBuilding({ x: 10, y: 0 });

    const result = findTroopTarget(troop, [destroyed, alive], [], null);
    expect(result).toBe(alive.instanceId);
  });

  it('falls back to non-preferred if an unknown favoriteTarget string is given', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const building = makeBuilding({ x: 5, y: 0 });

    // "Heroes" is not a key in TARGET_FILTERS, so no filter matches
    const result = findTroopTarget(troop, [building], [], 'Heroes');
    expect(result).toBe(building.instanceId);
  });
});

// ---------------------------------------------------------------------------
// findDefenseTarget
// ---------------------------------------------------------------------------
describe('findDefenseTarget', () => {
  it('returns the nearest troop within range', () => {
    const defense = makeDefense({ x: 0, y: 0, range: { min: 0, max: 15 } });
    const close = makeTroop({ x: 3, y: 4, state: 'moving' }); // distance 5
    const far = makeTroop({ x: 10, y: 10, state: 'moving' }); // distance ~14.1

    const result = findDefenseTarget(defense, [close, far]);
    expect(result).toBe(close.id);
  });

  it('returns null when no troops are in range', () => {
    const defense = makeDefense({ x: 0, y: 0, range: { min: 0, max: 5 } });
    const troop = makeTroop({ x: 10, y: 10, state: 'moving' }); // distance ~14.1

    const result = findDefenseTarget(defense, [troop]);
    expect(result).toBeNull();
  });

  it('returns null when there are no troops at all', () => {
    const defense = makeDefense({ x: 0, y: 0 });
    const result = findDefenseTarget(defense, []);
    expect(result).toBeNull();
  });

  it('skips dead troops', () => {
    const defense = makeDefense({ x: 0, y: 0, range: { min: 0, max: 20 } });
    const dead = makeTroop({ x: 1, y: 0, state: 'dead' });
    const alive = makeTroop({ x: 5, y: 0, state: 'attacking' });

    const result = findDefenseTarget(defense, [dead, alive]);
    expect(result).toBe(alive.id);
  });

  it('returns null when all troops are dead', () => {
    const defense = makeDefense({ x: 0, y: 0, range: { min: 0, max: 20 } });
    const dead1 = makeTroop({ x: 1, y: 0, state: 'dead' });
    const dead2 = makeTroop({ x: 2, y: 0, state: 'dead' });

    const result = findDefenseTarget(defense, [dead1, dead2]);
    expect(result).toBeNull();
  });

  it('Cannon (ground-only) skips flying troops', () => {
    const cannon = makeDefense({
      name: 'Cannon', x: 0, y: 0, range: { min: 0, max: 20 },
    });
    const flying = makeTroop({ x: 3, y: 0, isFlying: true, state: 'moving' });

    const result = findDefenseTarget(cannon, [flying]);
    expect(result).toBeNull();
  });

  it('Mortar (ground-only) skips flying troops', () => {
    const mortar = makeDefense({
      name: 'Mortar', x: 0, y: 0, range: { min: 0, max: 20 },
    });
    const flying = makeTroop({ x: 5, y: 0, isFlying: true, state: 'moving' });

    const result = findDefenseTarget(mortar, [flying]);
    expect(result).toBeNull();
  });

  it('Cannon targets ground troops correctly', () => {
    const cannon = makeDefense({
      name: 'Cannon', x: 0, y: 0, range: { min: 0, max: 20 },
    });
    const ground = makeTroop({ x: 5, y: 0, isFlying: false, state: 'moving' });

    const result = findDefenseTarget(cannon, [ground]);
    expect(result).toBe(ground.id);
  });

  it('Archer Tower can target flying troops', () => {
    const archerTower = makeDefense({
      name: 'Archer Tower', x: 0, y: 0, range: { min: 0, max: 20 },
    });
    const flying = makeTroop({ x: 5, y: 0, isFlying: true, state: 'moving' });

    const result = findDefenseTarget(archerTower, [flying]);
    expect(result).toBe(flying.id);
  });

  it('respects minimum range (troop too close is ignored)', () => {
    const defense = makeDefense({
      x: 0, y: 0, range: { min: 5, max: 20 },
    });
    const tooClose = makeTroop({ x: 1, y: 0, state: 'moving' }); // distance 1, under min
    const inRange = makeTroop({ x: 8, y: 0, state: 'moving' }); // distance 8, within range

    const result = findDefenseTarget(defense, [tooClose, inRange]);
    expect(result).toBe(inRange.id);
  });

  it('returns null when troop is between min and max but all are dead', () => {
    const defense = makeDefense({
      x: 0, y: 0, range: { min: 0, max: 50 },
    });
    const dead = makeTroop({ x: 5, y: 0, state: 'dead' });

    const result = findDefenseTarget(defense, [dead]);
    expect(result).toBeNull();
  });

  it('ground-only defense picks ground troop over closer flying troop', () => {
    const cannon = makeDefense({
      name: 'Cannon', x: 0, y: 0, range: { min: 0, max: 30 },
    });
    const flying = makeTroop({ x: 1, y: 0, isFlying: true, state: 'moving' });
    const ground = makeTroop({ x: 10, y: 0, isFlying: false, state: 'moving' });

    const result = findDefenseTarget(cannon, [flying, ground]);
    expect(result).toBe(ground.id);
  });

  it('picks the closest troop when multiple are in range', () => {
    const defense = makeDefense({ x: 0, y: 0, range: { min: 0, max: 50 } });
    const t1 = makeTroop({ x: 20, y: 0, state: 'idle' });
    const t2 = makeTroop({ x: 5, y: 0, state: 'idle' });
    const t3 = makeTroop({ x: 15, y: 0, state: 'idle' });

    const result = findDefenseTarget(defense, [t1, t2, t3]);
    expect(result).toBe(t2.id);
  });
});
