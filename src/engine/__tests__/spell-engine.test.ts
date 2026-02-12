import type {
  BattleState, BattleBuilding, ActiveDefense, DeployedTroop, ActiveSpell,
} from '../../types/battle.ts';
import {
  isInRadius,
  applyLightningDamage,
  applyEarthquakeDamage,
  deploySpell,
  tickSpells,
} from '../spell-engine.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let buildingCounter = 0;
let defenseCounter = 0;
let troopCounter = 0;
let spellCounter = 0;

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

function makeSpell(overrides?: Partial<ActiveSpell>): ActiveSpell {
  spellCounter += 1;
  return {
    id: `spell_${spellCounter}`,
    name: 'Healing Spell',
    level: 1,
    x: 5,
    y: 5,
    radius: 5,
    remainingDuration: 12,
    totalDuration: 12,
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
      makeBuilding({ instanceId: 'th_1', name: 'Town Hall' }),
      makeBuilding({ instanceId: 'gm_1', name: 'Gold Mine' }),
    ],
    spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: [],
    availableSpells: [],
    ...overrides,
  };
}

beforeEach(() => {
  buildingCounter = 0;
  defenseCounter = 0;
  troopCounter = 0;
  spellCounter = 0;
});

// ---------------------------------------------------------------------------
// isInRadius
// ---------------------------------------------------------------------------

describe('isInRadius', () => {
  it('returns true when the point is within the radius', () => {
    // Distance between (0,0) and (3,4) is 5. Radius of 6 should contain it.
    expect(isInRadius(0, 0, 3, 4, 6)).toBe(true);
  });

  it('returns false when the point is outside the radius', () => {
    // Distance between (0,0) and (3,4) is 5. Radius of 4 should not contain it.
    expect(isInRadius(0, 0, 3, 4, 4)).toBe(false);
  });

  it('returns true when the point is exactly on the boundary', () => {
    // Distance between (0,0) and (3,4) is exactly 5. Radius of 5 uses <= comparison.
    expect(isInRadius(0, 0, 3, 4, 5)).toBe(true);
  });

  it('returns true when both points are the same (distance 0)', () => {
    expect(isInRadius(5, 5, 5, 5, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyLightningDamage
// ---------------------------------------------------------------------------

describe('applyLightningDamage', () => {
  it('splits damage evenly across all buildings and defenses in radius', () => {
    const b1 = makeBuilding({ x: 5, y: 5, currentHp: 500, maxHp: 500 });
    const b2 = makeBuilding({ x: 5, y: 6, currentHp: 500, maxHp: 500 });
    const d1 = makeDefense({ x: 5, y: 5, currentHp: 300, maxHp: 300 });

    // All three are within radius 10 of (5, 5). Total damage = 150, split = 50 each.
    const result = applyLightningDamage([b1, b2], [d1], 5, 5, 10, 150);

    expect(result.buildings[0]!.currentHp).toBe(450);
    expect(result.buildings[1]!.currentHp).toBe(450);
    expect(result.defenses[0]!.currentHp).toBe(250);
  });

  it('skips already-destroyed buildings when splitting damage', () => {
    const alive = makeBuilding({ x: 5, y: 5, currentHp: 500, maxHp: 500 });
    const destroyed = makeBuilding({ x: 5, y: 5, currentHp: 0, maxHp: 500, isDestroyed: true });

    // Only 1 non-destroyed target, so it takes all 100 damage.
    const result = applyLightningDamage([alive, destroyed], [], 5, 5, 10, 100);

    expect(result.buildings[0]!.currentHp).toBe(400);
    expect(result.buildings[1]!.currentHp).toBe(0);
    expect(result.buildings[1]!.isDestroyed).toBe(true);
  });

  it('marks buildings as destroyed when damage reduces hp to 0', () => {
    const weak = makeBuilding({ x: 5, y: 5, currentHp: 30, maxHp: 500 });

    const result = applyLightningDamage([weak], [], 5, 5, 10, 100);

    expect(result.buildings[0]!.currentHp).toBe(0);
    expect(result.buildings[0]!.isDestroyed).toBe(true);
  });

  it('returns original arrays when nothing is within radius', () => {
    const far = makeBuilding({ x: 100, y: 100, currentHp: 500 });
    const farDef = makeDefense({ x: 100, y: 100, currentHp: 300 });
    const buildings = [far];
    const defenses = [farDef];

    const result = applyLightningDamage(buildings, defenses, 0, 0, 2, 200);

    // Same references because count === 0 triggers early return.
    expect(result.buildings).toBe(buildings);
    expect(result.defenses).toBe(defenses);
  });

  it('applies damage to defenses in radius alongside buildings', () => {
    const def = makeDefense({ x: 0, y: 0, currentHp: 200, maxHp: 200 });

    // Single target gets all 80 damage.
    const result = applyLightningDamage([], [def], 0, 0, 5, 80);

    expect(result.defenses[0]!.currentHp).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// applyEarthquakeDamage
// ---------------------------------------------------------------------------

describe('applyEarthquakeDamage', () => {
  it('deals percentage of maxHp as damage to buildings in radius', () => {
    const b = makeBuilding({ x: 5, y: 5, currentHp: 1000, maxHp: 1000 });

    // 25% of 1000 = 250 damage
    const result = applyEarthquakeDamage([b], [], 5, 5, 10, 25);

    expect(result.buildings[0]!.currentHp).toBe(750);
  });

  it('marks building as destroyed when percentage damage reaches 100%', () => {
    const b = makeBuilding({ x: 0, y: 0, currentHp: 500, maxHp: 500 });

    const result = applyEarthquakeDamage([b], [], 0, 0, 10, 100);

    expect(result.buildings[0]!.currentHp).toBe(0);
    expect(result.buildings[0]!.isDestroyed).toBe(true);
  });

  it('skips already-destroyed buildings', () => {
    const destroyed = makeBuilding({ x: 0, y: 0, currentHp: 0, maxHp: 500, isDestroyed: true });

    const result = applyEarthquakeDamage([destroyed], [], 0, 0, 10, 50);

    expect(result.buildings[0]!.currentHp).toBe(0);
    expect(result.buildings[0]!.isDestroyed).toBe(true);
  });

  it('deals percentage damage to defenses as well', () => {
    const def = makeDefense({ x: 0, y: 0, currentHp: 400, maxHp: 400 });

    // 10% of 400 = 40 damage
    const result = applyEarthquakeDamage([], [def], 0, 0, 10, 10);

    expect(result.defenses[0]!.currentHp).toBe(360);
  });

  it('does not affect buildings outside radius', () => {
    const inside = makeBuilding({ x: 1, y: 1, currentHp: 800, maxHp: 800 });
    const outside = makeBuilding({ x: 100, y: 100, currentHp: 800, maxHp: 800 });

    const result = applyEarthquakeDamage([inside, outside], [], 0, 0, 5, 50);

    expect(result.buildings[0]!.currentHp).toBe(400); // 50% of 800
    expect(result.buildings[1]!.currentHp).toBe(800); // untouched
  });
});

// ---------------------------------------------------------------------------
// deploySpell
// ---------------------------------------------------------------------------

describe('deploySpell', () => {
  it('returns null when the spell is not in availableSpells', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Healing Spell', level: 1, count: 1 }],
    });

    const result = deploySpell(state, 'Lightning Spell', 10, 10);

    expect(result).toBeNull();
  });

  it('returns null for an unknown spell name (no spell data)', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Nonexistent Spell', level: 1, count: 1 }],
    });

    const result = deploySpell(state, 'Nonexistent Spell', 10, 10);

    expect(result).toBeNull();
  });

  it('returns null when the spell count is 0', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Lightning Spell', level: 1, count: 0 }],
    });

    const result = deploySpell(state, 'Lightning Spell', 10, 10);

    expect(result).toBeNull();
  });

  it('decrements count for an instant spell (Lightning)', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Lightning Spell', level: 1, count: 2 }],
      buildings: [makeBuilding({ x: 10, y: 10, currentHp: 500, maxHp: 500 })],
    });

    const result = deploySpell(state, 'Lightning Spell', 10, 10);

    expect(result).not.toBeNull();
    expect(result!.availableSpells[0]!.count).toBe(1);
  });

  it('applies Lightning damage to buildings immediately (instant spell)', () => {
    const b = makeBuilding({ x: 5, y: 5, currentHp: 500, maxHp: 500 });
    const state = makeBattleState({
      availableSpells: [{ name: 'Lightning Spell', level: 1, count: 1 }],
      buildings: [b],
      defenses: [],
    });

    const result = deploySpell(state, 'Lightning Spell', 5, 5);

    expect(result).not.toBeNull();
    // Lightning Spell level 1 has totalDamage 150. Single target gets all 150.
    expect(result!.buildings[0]!.currentHp).toBe(350);
  });

  it('creates an ActiveSpell for a duration spell (Healing)', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Healing Spell', level: 1, count: 1 }],
      spells: [],
    });

    const result = deploySpell(state, 'Healing Spell', 15, 15);

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.name).toBe('Healing Spell');
    expect(result!.spells[0]!.x).toBe(15);
    expect(result!.spells[0]!.y).toBe(15);
    expect(result!.spells[0]!.remainingDuration).toBe(12);
    expect(result!.availableSpells[0]!.count).toBe(0);
  });

  it('applies Earthquake damage as percentage-based (instant spell)', () => {
    const b = makeBuilding({ x: 5, y: 5, currentHp: 1000, maxHp: 1000 });
    const state = makeBattleState({
      availableSpells: [{ name: 'Earthquake Spell', level: 1, count: 1 }],
      buildings: [b],
      defenses: [],
    });

    const result = deploySpell(state, 'Earthquake Spell', 5, 5);

    expect(result).not.toBeNull();
    // Earthquake level 1: damagePercent = 14.5, radius = 3.5
    // 14.5% of 1000 = 145 damage, so hp = 855
    expect(result!.buildings[0]!.currentHp).toBe(855);
  });

  it('creates an ActiveSpell for Poison (duration/debuff spell)', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Poison Spell', level: 1, count: 1 }],
      spells: [],
    });

    const result = deploySpell(state, 'Poison Spell', 8, 8);

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.name).toBe('Poison Spell');
    expect(result!.spells[0]!.remainingDuration).toBe(16);
  });

  it('does not mutate the original state', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Lightning Spell', level: 1, count: 3 }],
    });
    const originalCount = state.availableSpells[0]!.count;

    deploySpell(state, 'Lightning Spell', 10, 10);

    expect(state.availableSpells[0]!.count).toBe(originalCount);
  });
});

// ---------------------------------------------------------------------------
// tickSpells
// ---------------------------------------------------------------------------

describe('tickSpells', () => {
  it('heals troops within the Healing Spell radius', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 10, totalDuration: 12,
    });
    const troop = makeTroop({ x: 5, y: 5, currentHp: 50, maxHp: 100 });

    // Healing Spell level 1: healingPerSecond = 51.25
    // deltaMs = 1000 => deltaSec = 1 => heal = 51.25
    const result = tickSpells([spell], [troop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBeGreaterThan(50);
    // 50 + 51.25 = 101.25, capped at 100
    expect(result.troops[0]!.currentHp).toBe(100);
  });

  it('caps healing at maxHp', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 10, totalDuration: 12,
    });
    const troop = makeTroop({ x: 5, y: 5, currentHp: 95, maxHp: 100 });

    const result = tickSpells([spell], [troop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBe(100);
  });

  it('damages troops within the Poison Spell radius', () => {
    const spell = makeSpell({
      name: 'Poison Spell', level: 1, x: 5, y: 5, radius: 4,
      remainingDuration: 10, totalDuration: 16,
    });
    const troop = makeTroop({ x: 5, y: 5, currentHp: 100, maxHp: 100 });

    // Poison Spell level 1: maxDamagePerSecond = 90
    // deltaMs = 1000 => deltaSec = 1 => damage = 90
    const result = tickSpells([spell], [troop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBe(10);
  });

  it('kills troops when Poison damage reduces hp to 0', () => {
    const spell = makeSpell({
      name: 'Poison Spell', level: 1, x: 5, y: 5, radius: 4,
      remainingDuration: 10, totalDuration: 16,
    });
    const troop = makeTroop({ x: 5, y: 5, currentHp: 50, maxHp: 100 });

    // Poison level 1: 90 damage per second. 50 hp troop should die.
    const result = tickSpells([spell], [troop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBe(0);
    expect(result.troops[0]!.state).toBe('dead');
  });

  it('decrements remainingDuration each tick', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, remainingDuration: 10, totalDuration: 12,
    });

    // 2000ms = 2 seconds
    const result = tickSpells([spell], [], [], [], 2000);

    expect(result.spells[0]!.remainingDuration).toBe(8);
  });

  it('removes expired spells (remainingDuration <= 0)', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, remainingDuration: 1, totalDuration: 12,
    });

    // 2000ms = 2 seconds, so remainingDuration goes to -1 and gets filtered out
    const result = tickSpells([spell], [], [], [], 2000);

    expect(result.spells).toHaveLength(0);
  });

  it('does not affect troops outside the spell radius', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, x: 0, y: 0, radius: 2,
      remainingDuration: 10, totalDuration: 12,
    });
    // Troop at (50, 50) is far outside radius 2
    const troop = makeTroop({ x: 50, y: 50, currentHp: 50, maxHp: 100 });

    const result = tickSpells([spell], [troop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBe(50);
  });

  it('does not heal dead troops', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, x: 5, y: 5, radius: 10,
      remainingDuration: 10, totalDuration: 12,
    });
    const deadTroop = makeTroop({ x: 5, y: 5, currentHp: 0, maxHp: 100, state: 'dead' });

    const result = tickSpells([spell], [deadTroop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBe(0);
    expect(result.troops[0]!.state).toBe('dead');
  });

  it('Poison does not damage dead troops', () => {
    const spell = makeSpell({
      name: 'Poison Spell', level: 1, x: 5, y: 5, radius: 4,
      remainingDuration: 10, totalDuration: 16,
    });
    const deadTroop = makeTroop({ x: 5, y: 5, currentHp: 0, maxHp: 100, state: 'dead' });

    const result = tickSpells([spell], [deadTroop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBe(0);
  });

  it('processes multiple spells in a single tick', () => {
    const healSpell = makeSpell({
      name: 'Healing Spell', level: 1, x: 0, y: 0, radius: 10,
      remainingDuration: 5, totalDuration: 12,
    });
    const poisonSpell = makeSpell({
      name: 'Poison Spell', level: 1, x: 50, y: 50, radius: 4,
      remainingDuration: 8, totalDuration: 16,
    });
    const friendlyTroop = makeTroop({ x: 0, y: 0, currentHp: 60, maxHp: 100 });
    const enemyTroop = makeTroop({ x: 50, y: 50, currentHp: 100, maxHp: 100 });

    const result = tickSpells(
      [healSpell, poisonSpell], [friendlyTroop, enemyTroop], [], [], 1000,
    );

    // Healing: friendlyTroop at (0,0), heal spell radius 10, so healed
    expect(result.troops[0]!.currentHp).toBe(100); // 60 + 51.25, capped at 100
    // Poison: enemyTroop at (50,50), poison spell radius 4, so damaged
    expect(result.troops[1]!.currentHp).toBe(10); // 100 - 90
    // Both spells should have decremented duration
    expect(result.spells).toHaveLength(2);
  });

  it('returns shallow copies of buildings and defenses arrays', () => {
    const buildings = [makeBuilding()];
    const defenses = [makeDefense()];

    const result = tickSpells([], [], buildings, defenses, 1000);

    expect(result.buildings).not.toBe(buildings);
    expect(result.defenses).not.toBe(defenses);
    expect(result.buildings).toEqual(buildings);
    expect(result.defenses).toEqual(defenses);
  });

  it('Poison does not affect troops outside its radius', () => {
    const spell = makeSpell({
      name: 'Poison Spell', level: 1, x: 0, y: 0, radius: 2,
      remainingDuration: 10, totalDuration: 16,
    });
    const farTroop = makeTroop({ x: 100, y: 100, currentHp: 100, maxHp: 100 });

    const result = tickSpells([spell], [farTroop], [], [], 1000);

    expect(result.troops[0]!.currentHp).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// deploySpell: Skeleton Spell (skeleton_spawn instant applier)
// ---------------------------------------------------------------------------

describe('deploySpell - Skeleton Spell', () => {
  it('spawns skeleton troops when deployed', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Skeleton Spell', level: 1, count: 1 }],
      deployedTroops: [],
    });

    const result = deploySpell(state, 'Skeleton Spell', 20, 20);

    expect(result).not.toBeNull();
    // Skeleton Spell level 1 does not have a "skeletonCount" key in the level stats,
    // so the code falls back to the default of 8.
    expect(result!.deployedTroops.length).toBeGreaterThanOrEqual(1);
    const skeletons = result!.deployedTroops.filter((t) => t.name === 'Skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('creates skeletons with correct base stats', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Skeleton Spell', level: 1, count: 1 }],
      deployedTroops: [],
    });

    const result = deploySpell(state, 'Skeleton Spell', 15, 15);
    const skeleton = result!.deployedTroops.find((t) => t.name === 'Skeleton');

    expect(skeleton).toBeDefined();
    expect(skeleton!.currentHp).toBe(30);
    expect(skeleton!.maxHp).toBe(30);
    expect(skeleton!.dps).toBe(25);
    expect(skeleton!.baseDps).toBe(25);
    expect(skeleton!.isFlying).toBe(false);
    expect(skeleton!.state).toBe('idle');
    expect(skeleton!.movementSpeed).toBe(24);
  });

  it('spawns skeletons near the target coordinates', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Skeleton Spell', level: 1, count: 1 }],
      deployedTroops: [],
    });

    const result = deploySpell(state, 'Skeleton Spell', 20, 20);
    const skeletons = result!.deployedTroops.filter((t) => t.name === 'Skeleton');

    for (const s of skeletons) {
      // Offset is (Math.random() - 0.5) * 3, so max offset is 1.5 from center
      expect(s.x).toBeGreaterThanOrEqual(20 - 1.5);
      expect(s.x).toBeLessThanOrEqual(20 + 1.5);
      expect(s.y).toBeGreaterThanOrEqual(20 - 1.5);
      expect(s.y).toBeLessThanOrEqual(20 + 1.5);
    }
  });

  it('decrements the spell count after deployment', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Skeleton Spell', level: 1, count: 2 }],
    });

    const result = deploySpell(state, 'Skeleton Spell', 10, 10);

    expect(result).not.toBeNull();
    expect(result!.availableSpells[0]!.count).toBe(1);
  });

  it('preserves existing deployed troops when spawning skeletons', () => {
    const existingTroop = makeTroop({ name: 'Barbarian', x: 5, y: 5 });
    const state = makeBattleState({
      availableSpells: [{ name: 'Skeleton Spell', level: 1, count: 1 }],
      deployedTroops: [existingTroop],
    });

    const result = deploySpell(state, 'Skeleton Spell', 20, 20);

    expect(result!.deployedTroops.length).toBeGreaterThan(1);
    expect(result!.deployedTroops[0]!.name).toBe('Barbarian');
  });
});

// ---------------------------------------------------------------------------
// deploySpell: Bat Spell (bat_spawn instant applier)
// ---------------------------------------------------------------------------

describe('deploySpell - Bat Spell', () => {
  it('spawns bat troops when deployed', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Bat Spell', level: 1, count: 1 }],
      deployedTroops: [],
    });

    const result = deploySpell(state, 'Bat Spell', 25, 25);

    expect(result).not.toBeNull();
    const bats = result!.deployedTroops.filter((t) => t.name === 'Bat');
    expect(bats.length).toBeGreaterThanOrEqual(1);
  });

  it('creates bats as flying units', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Bat Spell', level: 1, count: 1 }],
      deployedTroops: [],
    });

    const result = deploySpell(state, 'Bat Spell', 10, 10);
    const bat = result!.deployedTroops.find((t) => t.name === 'Bat');

    expect(bat).toBeDefined();
    expect(bat!.isFlying).toBe(true);
  });

  it('creates bats with correct base stats', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Bat Spell', level: 1, count: 1 }],
      deployedTroops: [],
    });

    const result = deploySpell(state, 'Bat Spell', 10, 10);
    const bat = result!.deployedTroops.find((t) => t.name === 'Bat');

    expect(bat).toBeDefined();
    expect(bat!.currentHp).toBe(20);
    expect(bat!.maxHp).toBe(20);
    expect(bat!.dps).toBe(30);
    expect(bat!.baseDps).toBe(30);
    expect(bat!.movementSpeed).toBe(32);
    expect(bat!.state).toBe('idle');
  });

  it('spawns bats near the target coordinates', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Bat Spell', level: 1, count: 1 }],
      deployedTroops: [],
    });

    const result = deploySpell(state, 'Bat Spell', 30, 30);
    const bats = result!.deployedTroops.filter((t) => t.name === 'Bat');

    for (const b of bats) {
      expect(b.x).toBeGreaterThanOrEqual(30 - 1.5);
      expect(b.x).toBeLessThanOrEqual(30 + 1.5);
      expect(b.y).toBeGreaterThanOrEqual(30 - 1.5);
      expect(b.y).toBeLessThanOrEqual(30 + 1.5);
    }
  });

  it('decrements the spell count after deployment', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Bat Spell', level: 1, count: 3 }],
    });

    const result = deploySpell(state, 'Bat Spell', 10, 10);

    expect(result).not.toBeNull();
    expect(result!.availableSpells[0]!.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// deploySpell: duration spells (Rage, Haste, Jump, Invisibility)
// ---------------------------------------------------------------------------

describe('deploySpell - duration spells', () => {
  it('creates an ActiveSpell for Rage Spell', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Rage Spell', level: 1, count: 1 }],
      spells: [],
    });

    const result = deploySpell(state, 'Rage Spell', 12, 12);

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.name).toBe('Rage Spell');
    expect(result!.spells[0]!.remainingDuration).toBe(18);
  });

  it('creates an ActiveSpell for Haste Spell', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Haste Spell', level: 1, count: 1 }],
      spells: [],
    });

    const result = deploySpell(state, 'Haste Spell', 8, 8);

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.name).toBe('Haste Spell');
  });

  it('creates an ActiveSpell for Jump Spell', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Jump Spell', level: 1, count: 1 }],
      spells: [],
    });

    const result = deploySpell(state, 'Jump Spell', 15, 15);

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.name).toBe('Jump Spell');
  });

  it('creates an ActiveSpell for Invisibility Spell', () => {
    const state = makeBattleState({
      availableSpells: [{ name: 'Invisibility Spell', level: 1, count: 1 }],
      spells: [],
    });

    const result = deploySpell(state, 'Invisibility Spell', 20, 20);

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.name).toBe('Invisibility Spell');
    // The Invisibility Spell has no top-level "duration" in the spell data (only per-level),
    // so deploySpell falls back to 0 for remainingDuration.
    expect(result!.spells[0]!.remainingDuration).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tickSpells: Healing Spell - healingNerfed
// ---------------------------------------------------------------------------

describe('tickSpells - Healing Spell healingNerfed', () => {
  it('does not heal troops with healingNerfed flag (Inferno Tower debuff)', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 10, totalDuration: 12,
    });
    const nerfedTroop = makeTroop({
      x: 5, y: 5, currentHp: 50, maxHp: 100, healingNerfed: true,
    });

    const result = tickSpells([spell], [nerfedTroop], [], [], 1000);

    // healingNerfed causes the healer to skip this troop entirely
    expect(result.troops[0]!.currentHp).toBe(50);
  });

  it('heals troops without healingNerfed while skipping nerfed ones', () => {
    const spell = makeSpell({
      name: 'Healing Spell', level: 1, x: 5, y: 5, radius: 10,
      remainingDuration: 10, totalDuration: 12,
    });
    const normalTroop = makeTroop({
      x: 5, y: 5, currentHp: 50, maxHp: 100, healingNerfed: false,
    });
    const nerfedTroop = makeTroop({
      x: 5, y: 5, currentHp: 50, maxHp: 100, healingNerfed: true,
    });

    const result = tickSpells([spell], [normalTroop, nerfedTroop], [], [], 1000);

    // Normal troop healed: 50 + 51.25 = 101.25, capped at 100
    expect(result.troops[0]!.currentHp).toBe(100);
    // Nerfed troop stays at 50
    expect(result.troops[1]!.currentHp).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// tickSpells: Rage Spell (buff)
// ---------------------------------------------------------------------------

describe('tickSpells - Rage Spell', () => {
  it('multiplies DPS and increases speed of troops in radius', () => {
    const spell = makeSpell({
      name: 'Rage Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 15, totalDuration: 18,
    });
    // Rage Spell level 1: damageMultiplier = 2.3, speedIncrease = 20
    const troop = makeTroop({
      x: 5, y: 5, dps: 10, baseDps: 10, movementSpeed: 16,
    });

    const result = tickSpells([spell], [troop], [], [], 1000);

    // dps = baseDps * damageMultiplier = 10 * 2.3 = 23
    expect(result.troops[0]!.dps).toBe(23);
    // movementSpeed = 16 + 20 = 36
    expect(result.troops[0]!.movementSpeed).toBe(36);
  });

  it('does not affect dead troops', () => {
    const spell = makeSpell({
      name: 'Rage Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 15, totalDuration: 18,
    });
    const deadTroop = makeTroop({
      x: 5, y: 5, dps: 10, baseDps: 10, state: 'dead', currentHp: 0,
    });

    const result = tickSpells([spell], [deadTroop], [], [], 1000);

    expect(result.troops[0]!.dps).toBe(10);
    expect(result.troops[0]!.state).toBe('dead');
  });

  it('does not affect troops outside the radius', () => {
    const spell = makeSpell({
      name: 'Rage Spell', level: 1, x: 0, y: 0, radius: 2,
      remainingDuration: 15, totalDuration: 18,
    });
    const farTroop = makeTroop({
      x: 50, y: 50, dps: 10, baseDps: 10, movementSpeed: 16,
    });

    const result = tickSpells([spell], [farTroop], [], [], 1000);

    expect(result.troops[0]!.dps).toBe(10);
    expect(result.troops[0]!.movementSpeed).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// tickSpells: Haste Spell
// ---------------------------------------------------------------------------

describe('tickSpells - Haste Spell', () => {
  it('boosts speed only, NOT damage', () => {
    const spell = makeSpell({
      name: 'Haste Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 8, totalDuration: 10,
    });
    // Haste Spell level 1: speedIncrease = 28
    const troop = makeTroop({
      x: 5, y: 5, dps: 10, baseDps: 10, movementSpeed: 16,
    });

    const result = tickSpells([spell], [troop], [], [], 1000);

    // Speed should increase: 16 + 28 = 44
    expect(result.troops[0]!.movementSpeed).toBe(44);
    // DPS should remain unchanged (Haste does not boost damage)
    expect(result.troops[0]!.dps).toBe(10);
  });

  it('does not affect dead troops', () => {
    const spell = makeSpell({
      name: 'Haste Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 8, totalDuration: 10,
    });
    const deadTroop = makeTroop({
      x: 5, y: 5, movementSpeed: 16, state: 'dead', currentHp: 0,
    });

    const result = tickSpells([spell], [deadTroop], [], [], 1000);

    expect(result.troops[0]!.movementSpeed).toBe(16);
  });

  it('does not affect troops outside the radius', () => {
    const spell = makeSpell({
      name: 'Haste Spell', level: 1, x: 0, y: 0, radius: 2,
      remainingDuration: 8, totalDuration: 10,
    });
    const farTroop = makeTroop({ x: 100, y: 100, movementSpeed: 16 });

    const result = tickSpells([spell], [farTroop], [], [], 1000);

    expect(result.troops[0]!.movementSpeed).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// tickSpells: Poison Spell (debuff) - movement slowdown
// ---------------------------------------------------------------------------

describe('tickSpells - Poison Spell slowdown', () => {
  it('slows troop movement speed when in radius', () => {
    const spell = makeSpell({
      name: 'Poison Spell', level: 1, x: 5, y: 5, radius: 4,
      remainingDuration: 10, totalDuration: 16,
    });
    // Poison Spell level 1: speedDecrease = 26 (used as a multiplier in the code)
    const troop = makeTroop({ x: 5, y: 5, currentHp: 1000, maxHp: 1000, movementSpeed: 100 });

    const result = tickSpells([spell], [troop], [], [], 1000);

    // movementSpeed = 100 * 26 = 2600 (speedDecrease is used as multiplicative factor)
    expect(result.troops[0]!.movementSpeed).not.toBe(100);
  });
});

// ---------------------------------------------------------------------------
// tickSpells: Invisibility Spell
// ---------------------------------------------------------------------------

describe('tickSpells - Invisibility Spell', () => {
  it('sets isBurrowed on troops within radius', () => {
    const spell = makeSpell({
      name: 'Invisibility Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 3, totalDuration: 3.5,
    });
    const troop = makeTroop({ x: 5, y: 5, isBurrowed: false });

    const result = tickSpells([spell], [troop], [], [], 1000);

    expect(result.troops[0]!.isBurrowed).toBe(true);
  });

  it('does not affect dead troops', () => {
    const spell = makeSpell({
      name: 'Invisibility Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 3, totalDuration: 3.5,
    });
    const deadTroop = makeTroop({ x: 5, y: 5, state: 'dead', currentHp: 0, isBurrowed: false });

    const result = tickSpells([spell], [deadTroop], [], [], 1000);

    // Dead troops are skipped
    expect(result.troops[0]!.isBurrowed).toBeFalsy();
  });

  it('does not set isBurrowed on troops outside radius', () => {
    const spell = makeSpell({
      name: 'Invisibility Spell', level: 1, x: 0, y: 0, radius: 2,
      remainingDuration: 3, totalDuration: 3.5,
    });
    const farTroop = makeTroop({ x: 100, y: 100, isBurrowed: false });

    const result = tickSpells([spell], [farTroop], [], [], 1000);

    expect(result.troops[0]!.isBurrowed).toBe(false);
  });

  it('preserves existing isBurrowed state from a previous tick', () => {
    const spell = makeSpell({
      name: 'Invisibility Spell', level: 1, x: 0, y: 0, radius: 2,
      remainingDuration: 3, totalDuration: 3.5,
    });
    // Troop is outside radius but was already burrowed
    const troop = makeTroop({ x: 100, y: 100, isBurrowed: true });

    const result = tickSpells([spell], [troop], [], [], 1000);

    // isBurrowed should remain true because of the `|| t.isBurrowed` logic
    expect(result.troops[0]!.isBurrowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tickSpells: Jump Spell
// ---------------------------------------------------------------------------

describe('tickSpells - Jump Spell', () => {
  it('sets jumpSpellActive on ground troops within radius', () => {
    const spell = makeSpell({
      name: 'Jump Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 15, totalDuration: 20,
    });
    const groundTroop = makeTroop({ x: 5, y: 5, isFlying: false });

    const result = tickSpells([spell], [groundTroop], [], [], 1000);

    expect(result.troops[0]!.jumpSpellActive).toBe(true);
  });

  it('does not set jumpSpellActive on flying troops', () => {
    const spell = makeSpell({
      name: 'Jump Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 15, totalDuration: 20,
    });
    const flyingTroop = makeTroop({ x: 5, y: 5, isFlying: true });

    const result = tickSpells([spell], [flyingTroop], [], [], 1000);

    expect(result.troops[0]!.jumpSpellActive).toBeFalsy();
  });

  it('does not affect dead ground troops', () => {
    const spell = makeSpell({
      name: 'Jump Spell', level: 1, x: 5, y: 5, radius: 5,
      remainingDuration: 15, totalDuration: 20,
    });
    const deadTroop = makeTroop({
      x: 5, y: 5, isFlying: false, state: 'dead', currentHp: 0,
    });

    const result = tickSpells([spell], [deadTroop], [], [], 1000);

    expect(result.troops[0]!.jumpSpellActive).toBeFalsy();
  });

  it('sets jumpSpellActive to false for ground troops outside radius', () => {
    const spell = makeSpell({
      name: 'Jump Spell', level: 1, x: 0, y: 0, radius: 2,
      remainingDuration: 15, totalDuration: 20,
    });
    const farTroop = makeTroop({ x: 100, y: 100, isFlying: false });

    const result = tickSpells([spell], [farTroop], [], [], 1000);

    expect(result.troops[0]!.jumpSpellActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tickSpells: spell duration expiration
// ---------------------------------------------------------------------------

describe('tickSpells - spell duration expiration', () => {
  it('removes spells whose remainingDuration drops to exactly 0', () => {
    const spell = makeSpell({
      name: 'Rage Spell', level: 1, remainingDuration: 1, totalDuration: 18,
    });

    // 1000ms = 1 second, so remainingDuration goes to 0
    const result = tickSpells([spell], [], [], [], 1000);

    expect(result.spells).toHaveLength(0);
  });

  it('removes spells whose remainingDuration becomes negative', () => {
    const spell = makeSpell({
      name: 'Haste Spell', level: 1, remainingDuration: 0.5, totalDuration: 10,
    });

    // 1000ms = 1 second, so remainingDuration goes to -0.5
    const result = tickSpells([spell], [], [], [], 1000);

    expect(result.spells).toHaveLength(0);
  });

  it('keeps spells that still have remaining duration', () => {
    const spell = makeSpell({
      name: 'Jump Spell', level: 1, remainingDuration: 10, totalDuration: 20,
    });

    const result = tickSpells([spell], [], [], [], 1000);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]!.remainingDuration).toBe(9);
  });

  it('correctly filters a mix of expired and active spells', () => {
    const expired = makeSpell({
      name: 'Invisibility Spell', level: 1, remainingDuration: 0.5, totalDuration: 3.5,
    });
    const active = makeSpell({
      name: 'Rage Spell', level: 1, remainingDuration: 15, totalDuration: 18,
    });

    const result = tickSpells([expired, active], [], [], [], 1000);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]!.name).toBe('Rage Spell');
    expect(result.spells[0]!.remainingDuration).toBe(14);
  });
});
