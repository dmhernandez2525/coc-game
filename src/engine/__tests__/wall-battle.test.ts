import type { DeployedTroop, BattleBuilding, ActiveDefense, ActiveSpell } from '../../types/battle.ts';
import { isWallBlocking, findBlockingWall } from '../targeting-ai.ts';
import { applyEarthquakeDamage, earthquakeDamageForHit, tickSpells } from '../spell-engine.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function makeWall(overrides?: Partial<BattleBuilding>): BattleBuilding {
  counter += 1;
  return {
    instanceId: `wall_${counter}`,
    name: 'Wall',
    currentHp: 500,
    maxHp: 500,
    x: 5,
    y: 5,
    isDestroyed: false,
    weight: 0,
    ...overrides,
  };
}

function makeBuilding(overrides?: Partial<BattleBuilding>): BattleBuilding {
  counter += 1;
  return {
    instanceId: `bld_${counter}`,
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

function makeTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  counter += 1;
  return {
    id: `troop_${counter}`,
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 0,
    y: 0,
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

beforeEach(() => {
  counter = 0;
});

// ---------------------------------------------------------------------------
// isWallBlocking
// ---------------------------------------------------------------------------
describe('isWallBlocking', () => {
  it('returns true when a wall is directly in the movement path', () => {
    const wall = makeWall({ x: 5, y: 0 });
    expect(isWallBlocking(0, 0, 10, 0, wall)).toBe(true);
  });

  it('returns false when a wall is far from the movement path', () => {
    const wall = makeWall({ x: 5, y: 10 });
    expect(isWallBlocking(0, 0, 10, 0, wall)).toBe(false);
  });

  it('returns false for destroyed walls', () => {
    const wall = makeWall({ x: 5, y: 0, isDestroyed: true });
    expect(isWallBlocking(0, 0, 10, 0, wall)).toBe(false);
  });

  it('returns false for non-wall buildings', () => {
    const building = makeBuilding({ x: 5, y: 0, name: 'Barracks' });
    expect(isWallBlocking(0, 0, 10, 0, building)).toBe(false);
  });

  it('returns true when wall is within 0.6 tiles of the path line', () => {
    const wall = makeWall({ x: 5, y: 0.5 });
    expect(isWallBlocking(0, 0, 10, 0, wall)).toBe(true);
  });

  it('returns false when wall is just outside the 0.6 tile threshold', () => {
    const wall = makeWall({ x: 5, y: 0.7 });
    expect(isWallBlocking(0, 0, 10, 0, wall)).toBe(false);
  });

  it('works with diagonal paths', () => {
    const wall = makeWall({ x: 5, y: 5 });
    expect(isWallBlocking(0, 0, 10, 10, wall)).toBe(true);
  });

  it('returns false when from and to are the same point', () => {
    const wall = makeWall({ x: 5, y: 5 });
    expect(isWallBlocking(5, 5, 5, 5, wall)).toBe(false);
  });

  it('detects wall near the start of the path', () => {
    const wall = makeWall({ x: 0.5, y: 0 });
    expect(isWallBlocking(0, 0, 10, 0, wall)).toBe(true);
  });

  it('detects wall near the end of the path', () => {
    const wall = makeWall({ x: 9.5, y: 0 });
    expect(isWallBlocking(0, 0, 10, 0, wall)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findBlockingWall
// ---------------------------------------------------------------------------
describe('findBlockingWall', () => {
  it('returns the nearest blocking wall instanceId', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const nearWall = makeWall({ x: 3, y: 0 });
    const farWall = makeWall({ x: 7, y: 0 });
    const target = makeBuilding({ x: 10, y: 0 });

    const result = findBlockingWall(troop, target.x, target.y, [nearWall, farWall, target]);
    expect(result).toBe(nearWall.instanceId);
  });

  it('returns null when no walls block the path', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const wall = makeWall({ x: 5, y: 10 });
    const target = makeBuilding({ x: 10, y: 0 });

    const result = findBlockingWall(troop, target.x, target.y, [wall, target]);
    expect(result).toBeNull();
  });

  it('returns null when the only blocking wall is destroyed', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const wall = makeWall({ x: 5, y: 0, isDestroyed: true });
    const target = makeBuilding({ x: 10, y: 0 });

    const result = findBlockingWall(troop, target.x, target.y, [wall, target]);
    expect(result).toBeNull();
  });

  it('ignores non-wall buildings in the path', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    const barracks = makeBuilding({ x: 5, y: 0, name: 'Barracks' });
    const target = makeBuilding({ x: 10, y: 0 });

    const result = findBlockingWall(troop, target.x, target.y, [barracks, target]);
    expect(result).toBeNull();
  });

  it('returns null when buildings array is empty', () => {
    const troop = makeTroop({ x: 0, y: 0 });
    expect(findBlockingWall(troop, 10, 0, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// earthquakeDamageForHit - diminishing returns
// ---------------------------------------------------------------------------
describe('earthquakeDamageForHit', () => {
  it('applies full damage on the first hit (non-wall)', () => {
    const dmg = earthquakeDamageForHit(14.5, 1, 1000, false);
    expect(dmg).toBeCloseTo(145, 1);
  });

  it('applies 1/3 damage on the second hit (non-wall)', () => {
    const dmg = earthquakeDamageForHit(14.5, 2, 1000, false);
    expect(dmg).toBeCloseTo(48.33, 1);
  });

  it('applies 1/5 damage on the third hit (non-wall)', () => {
    const dmg = earthquakeDamageForHit(14.5, 3, 1000, false);
    expect(dmg).toBeCloseTo(29, 1);
  });

  it('applies 1/7 damage on the fourth hit (non-wall)', () => {
    const dmg = earthquakeDamageForHit(14.5, 4, 1000, false);
    expect(dmg).toBeCloseTo(20.71, 1);
  });

  it('4th earthquake on a wall returns maxHp (guaranteed destruction)', () => {
    const dmg = earthquakeDamageForHit(14.5, 4, 14000, true);
    expect(dmg).toBe(14000);
  });

  it('5th earthquake on a wall also returns maxHp', () => {
    const dmg = earthquakeDamageForHit(14.5, 5, 14000, true);
    expect(dmg).toBe(14000);
  });

  it('4 earthquakes destroy any wall regardless of HP', () => {
    const wallMaxHp = 14000; // Level 19 wall
    let remainingHp = wallMaxHp;
    for (let hit = 1; hit <= 4; hit++) {
      const dmg = earthquakeDamageForHit(14.5, hit, wallMaxHp, true);
      remainingHp = Math.max(0, remainingHp - dmg);
    }
    expect(remainingHp).toBe(0);
  });

  it('3 earthquakes never destroy a wall (even with max level spell)', () => {
    const wallMaxHp = 100; // Weakest possible wall
    let remainingHp = wallMaxHp;
    for (let hit = 1; hit <= 3; hit++) {
      const dmg = earthquakeDamageForHit(25, hit, wallMaxHp, true); // Max level earthquake
      remainingHp -= dmg;
    }
    expect(remainingHp).toBeGreaterThan(0);
  });

  it('has no wall bonus on first 3 hits (wall damage = non-wall damage)', () => {
    for (let hit = 1; hit <= 3; hit++) {
      const nonWallDmg = earthquakeDamageForHit(14.5, hit, 1000, false);
      const wallDmg = earthquakeDamageForHit(14.5, hit, 1000, true);
      expect(wallDmg).toBeCloseTo(nonWallDmg, 5);
    }
  });

  it('diminishing returns reduces damage per successive non-wall hit', () => {
    const dmg1 = earthquakeDamageForHit(14.5, 1, 1000, false);
    const dmg2 = earthquakeDamageForHit(14.5, 2, 1000, false);
    const dmg3 = earthquakeDamageForHit(14.5, 3, 1000, false);
    expect(dmg1).toBeGreaterThan(dmg2);
    expect(dmg2).toBeGreaterThan(dmg3);
  });
});

// ---------------------------------------------------------------------------
// applyEarthquakeDamage (integration with diminishing returns)
// ---------------------------------------------------------------------------
describe('applyEarthquakeDamage', () => {
  it('increments earthquakeHitCount on affected buildings', () => {
    const wall = makeWall({ x: 5, y: 5, maxHp: 1000, currentHp: 1000 });
    const { buildings } = applyEarthquakeDamage([wall], [], 5, 5, 5, 14.5);
    expect(buildings[0]!.earthquakeHitCount).toBe(1);
  });

  it('does not increment earthquakeHitCount on buildings outside radius', () => {
    const wall = makeWall({ x: 50, y: 50, maxHp: 1000, currentHp: 1000 });
    const { buildings } = applyEarthquakeDamage([wall], [], 5, 5, 3.5, 14.5);
    expect(buildings[0]!.earthquakeHitCount).toBeUndefined();
  });

  it('applies diminishing damage on successive calls', () => {
    let wall = makeWall({ x: 5, y: 5, maxHp: 1000, currentHp: 1000 });

    // First earthquake
    let result = applyEarthquakeDamage([wall], [], 5, 5, 5, 14.5);
    const hpAfter1 = result.buildings[0]!.currentHp;
    expect(hpAfter1).toBeCloseTo(855, 0); // 1000 - 145

    // Second earthquake (pass the updated building)
    result = applyEarthquakeDamage(result.buildings, [], 5, 5, 5, 14.5);
    const hpAfter2 = result.buildings[0]!.currentHp;
    const damage2 = hpAfter1 - hpAfter2;
    expect(damage2).toBeLessThan(145); // Less than first hit due to diminishing returns
    expect(result.buildings[0]!.earthquakeHitCount).toBe(2);
  });

  it('does not affect destroyed buildings', () => {
    const wall = makeWall({ x: 5, y: 5, isDestroyed: true, currentHp: 0 });
    const { buildings } = applyEarthquakeDamage([wall], [], 5, 5, 5, 14.5);
    expect(buildings[0]!.currentHp).toBe(0);
    expect(buildings[0]!.earthquakeHitCount).toBeUndefined();
  });

  it('marks building as destroyed when HP reaches 0', () => {
    const wall = makeWall({ x: 5, y: 5, maxHp: 100, currentHp: 10 });
    const { buildings } = applyEarthquakeDamage([wall], [], 5, 5, 5, 14.5);
    expect(buildings[0]!.isDestroyed).toBe(true);
    expect(buildings[0]!.currentHp).toBe(0);
  });

  it('destroys wall on 4th earthquake', () => {
    let buildings = [makeWall({ x: 5, y: 5, maxHp: 14000, currentHp: 14000 })];
    for (let i = 0; i < 4; i++) {
      const result = applyEarthquakeDamage(buildings, [], 5, 5, 5, 14.5);
      buildings = result.buildings;
    }
    expect(buildings[0]!.isDestroyed).toBe(true);
    expect(buildings[0]!.currentHp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Jump Spell troop flag
// ---------------------------------------------------------------------------
describe('Jump Spell integration', () => {
  it('sets jumpSpellActive on ground troops in radius', () => {
    const troop = makeTroop({ x: 5, y: 5, isFlying: false });
    const spell: ActiveSpell = {
      id: 'jump_1', name: 'Jump Spell', level: 1,
      x: 5, y: 5, radius: 3.5, remainingDuration: 20, totalDuration: 20,
    };

    const result = tickSpells([spell], [troop], [], [], 100);
    expect(result.troops[0]!.jumpSpellActive).toBe(true);
  });

  it('does not set jumpSpellActive on troops outside radius', () => {
    const troop = makeTroop({ x: 50, y: 50, isFlying: false });
    const spell: ActiveSpell = {
      id: 'jump_1', name: 'Jump Spell', level: 1,
      x: 5, y: 5, radius: 3.5, remainingDuration: 20, totalDuration: 20,
    };

    const result = tickSpells([spell], [troop], [], [], 100);
    expect(result.troops[0]!.jumpSpellActive).toBeFalsy();
  });

  it('does not set jumpSpellActive on flying troops', () => {
    const troop = makeTroop({ x: 5, y: 5, isFlying: true });
    const spell: ActiveSpell = {
      id: 'jump_1', name: 'Jump Spell', level: 1,
      x: 5, y: 5, radius: 3.5, remainingDuration: 20, totalDuration: 20,
    };

    const result = tickSpells([spell], [troop], [], [], 100);
    expect(result.troops[0]!.jumpSpellActive).toBeFalsy();
  });

  it('clears jumpSpellActive when troop leaves radius', () => {
    const troop = makeTroop({ x: 50, y: 50, isFlying: false, jumpSpellActive: true });
    const spell: ActiveSpell = {
      id: 'jump_1', name: 'Jump Spell', level: 1,
      x: 5, y: 5, radius: 3.5, remainingDuration: 20, totalDuration: 20,
    };

    const result = tickSpells([spell], [troop], [], [], 100);
    expect(result.troops[0]!.jumpSpellActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wall collision in troop behavior
// ---------------------------------------------------------------------------
describe('Wall collision in battle', () => {
  it('ground troop redirects to attack blocking wall', () => {
    const troop = makeTroop({ x: 0, y: 0, isFlying: false });
    const wall = makeWall({ x: 5, y: 0 });
    const target = makeBuilding({ x: 10, y: 0 });

    const blockingId = findBlockingWall(troop, target.x, target.y, [wall, target]);
    expect(blockingId).toBe(wall.instanceId);
  });

  it('flying troop detection still finds walls (caller decides to skip)', () => {
    const troop = makeTroop({ x: 0, y: 0, isFlying: true });
    const wall = makeWall({ x: 5, y: 0 });
    const target = makeBuilding({ x: 10, y: 0 });

    const blockingId = findBlockingWall(troop, target.x, target.y, [wall, target]);
    expect(blockingId).toBe(wall.instanceId);
  });

  it('Hog Rider has canJumpWalls flag set', () => {
    const troop = makeTroop({ x: 0, y: 0, canJumpWalls: true, name: 'Hog Rider' });
    expect(troop.canJumpWalls).toBe(true);
  });

  it('troop with jumpSpellActive has the flag', () => {
    const troop = makeTroop({ x: 0, y: 0, jumpSpellActive: true });
    expect(troop.jumpSpellActive).toBe(true);
  });
});
