import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DeployedTroop, BattleBuilding, ActiveDefense } from '../../types/battle.ts';
import {
  processTroopSpecial,
  processDeathSpawns,
  processDeathDamage,
} from '../troop-mechanics.ts';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function makeTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  idCounter += 1;
  return {
    id: `troop_${idCounter}`,
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 10,
    y: 10,
    targetId: null,
    state: 'idle',
    dps: 20,
    baseDps: 20,
    attackRange: 0.6,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

function makeBuilding(overrides?: Partial<BattleBuilding>): BattleBuilding {
  idCounter += 1;
  return {
    instanceId: `bld_${idCounter}`,
    name: 'Archer Tower',
    currentHp: 500,
    maxHp: 500,
    x: 12,
    y: 12,
    isDestroyed: false,
    weight: 1,
    ...overrides,
  };
}

function makeDefense(overrides?: Partial<ActiveDefense>): ActiveDefense {
  idCounter += 1;
  return {
    buildingInstanceId: `bld_${idCounter}`,
    name: 'Archer Tower',
    level: 1,
    currentHp: 500,
    maxHp: 500,
    x: 12,
    y: 12,
    targetTroopId: null,
    dps: 30,
    baseDps: 30,
    range: { min: 0, max: 10 },
    attackSpeed: 1000,
    lastAttackTime: 0,
    isDestroyed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  idCounter = 0;
});

// ---------------------------------------------------------------------------
// 1. processTroopSpecial returns false for unknown/standard troops
// ---------------------------------------------------------------------------

describe('processTroopSpecial - unknown troops', () => {
  it('returns false for a Barbarian (no special handler)', () => {
    const troop = makeTroop({ name: 'Barbarian', state: 'attacking' });
    const result = processTroopSpecial(troop, [troop], [], [], 1000);
    expect(result).toBe(false);
  });

  it('returns false for an Archer (no special handler)', () => {
    const troop = makeTroop({ name: 'Archer', state: 'attacking' });
    const result = processTroopSpecial(troop, [troop], [], [], 1000);
    expect(result).toBe(false);
  });

  it('returns false for a Giant (no special handler)', () => {
    const troop = makeTroop({ name: 'Giant', state: 'attacking' });
    const result = processTroopSpecial(troop, [troop], [], [], 1000);
    expect(result).toBe(false);
  });

  it('does not mutate standard troop state', () => {
    const troop = makeTroop({ name: 'P.E.K.K.A', state: 'attacking', currentHp: 80 });
    processTroopSpecial(troop, [troop], [], [], 1000);
    expect(troop.currentHp).toBe(80);
    expect(troop.state).toBe('attacking');
  });
});

// ---------------------------------------------------------------------------
// 2. Wall Breaker
// ---------------------------------------------------------------------------

describe('Wall Breaker', () => {
  it('deals 40x damage to a Wall', () => {
    const wall = makeBuilding({ name: 'Wall', currentHp: 2000, maxHp: 2000 });
    const wb = makeTroop({
      name: 'Wall Breaker',
      state: 'attacking',
      targetId: wall.instanceId,
      dps: 10,
      wallDamageMultiplier: 40,
    });
    processTroopSpecial(wb, [wb], [wall], [], 1000);
    // 10 * 40 * 1 = 400 damage
    expect(wall.currentHp).toBe(1600);
  });

  it('self-destructs after attacking', () => {
    const wall = makeBuilding({ name: 'Wall', currentHp: 5000, maxHp: 5000 });
    const wb = makeTroop({
      name: 'Wall Breaker',
      state: 'attacking',
      targetId: wall.instanceId,
      dps: 10,
    });
    processTroopSpecial(wb, [wb], [wall], [], 1000);
    expect(wb.currentHp).toBe(0);
    expect(wb.state).toBe('dead');
  });

  it('deals only 1x damage to non-Wall buildings', () => {
    const building = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500 });
    const wb = makeTroop({
      name: 'Wall Breaker',
      state: 'attacking',
      targetId: building.instanceId,
      dps: 10,
    });
    processTroopSpecial(wb, [wb], [building], [], 1000);
    // 10 * 1 * 1 = 10 damage
    expect(building.currentHp).toBe(490);
  });

  it('destroys a Wall when damage exceeds HP', () => {
    const wall = makeBuilding({ name: 'Wall', currentHp: 100, maxHp: 2000 });
    const wb = makeTroop({
      name: 'Wall Breaker',
      state: 'attacking',
      targetId: wall.instanceId,
      dps: 10,
      wallDamageMultiplier: 40,
    });
    processTroopSpecial(wb, [wb], [wall], [], 1000);
    expect(wall.currentHp).toBe(0);
    expect(wall.isDestroyed).toBe(true);
  });

  it('returns true (special handler applied damage)', () => {
    const wall = makeBuilding({ name: 'Wall', currentHp: 5000, maxHp: 5000 });
    const wb = makeTroop({
      name: 'Wall Breaker',
      state: 'attacking',
      targetId: wall.instanceId,
      dps: 10,
    });
    const result = processTroopSpecial(wb, [wb], [wall], [], 1000);
    expect(result).toBe(true);
  });

  it('does nothing when dead', () => {
    const wall = makeBuilding({ name: 'Wall', currentHp: 500, maxHp: 500 });
    const wb = makeTroop({
      name: 'Wall Breaker',
      state: 'dead',
      targetId: wall.instanceId,
      dps: 10,
    });
    processTroopSpecial(wb, [wb], [wall], [], 1000);
    expect(wall.currentHp).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 3. Goblin
// ---------------------------------------------------------------------------

describe('Goblin', () => {
  it('deals 2x damage to Gold Storage', () => {
    const storage = makeBuilding({ name: 'Gold Storage', currentHp: 1000, maxHp: 1000 });
    const goblin = makeTroop({
      name: 'Goblin',
      state: 'attacking',
      targetId: storage.instanceId,
      dps: 20,
      resourceDamageMultiplier: 2,
    });
    processTroopSpecial(goblin, [goblin], [storage], [], 1000);
    // 20 * 2 * 1 = 40 damage
    expect(storage.currentHp).toBe(960);
  });

  it('deals 2x damage to Elixir Storage', () => {
    const storage = makeBuilding({ name: 'Elixir Storage', currentHp: 1000, maxHp: 1000 });
    const goblin = makeTroop({
      name: 'Goblin',
      state: 'attacking',
      targetId: storage.instanceId,
      dps: 20,
      resourceDamageMultiplier: 2,
    });
    processTroopSpecial(goblin, [goblin], [storage], [], 1000);
    expect(storage.currentHp).toBe(960);
  });

  it('deals 2x damage to Dark Elixir Storage', () => {
    const storage = makeBuilding({ name: 'Dark Elixir Storage', currentHp: 1000, maxHp: 1000 });
    const goblin = makeTroop({
      name: 'Goblin',
      state: 'attacking',
      targetId: storage.instanceId,
      dps: 20,
    });
    processTroopSpecial(goblin, [goblin], [storage], [], 1000);
    expect(storage.currentHp).toBe(960);
  });

  it('deals 2x damage to Town Hall', () => {
    const th = makeBuilding({ name: 'Town Hall', currentHp: 2000, maxHp: 2000 });
    const goblin = makeTroop({
      name: 'Goblin',
      state: 'attacking',
      targetId: th.instanceId,
      dps: 20,
    });
    processTroopSpecial(goblin, [goblin], [th], [], 1000);
    expect(th.currentHp).toBe(1960);
  });

  it('deals 1x damage to non-resource buildings', () => {
    const cannon = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500 });
    const goblin = makeTroop({
      name: 'Goblin',
      state: 'attacking',
      targetId: cannon.instanceId,
      dps: 20,
    });
    processTroopSpecial(goblin, [goblin], [cannon], [], 1000);
    // 20 * 1 * 1 = 20
    expect(cannon.currentHp).toBe(480);
  });

  it('returns true when goblin is attacking', () => {
    const storage = makeBuilding({ name: 'Gold Storage', currentHp: 1000, maxHp: 1000 });
    const goblin = makeTroop({
      name: 'Goblin',
      state: 'attacking',
      targetId: storage.instanceId,
      dps: 20,
    });
    const result = processTroopSpecial(goblin, [goblin], [storage], [], 1000);
    expect(result).toBe(true);
  });

  it('syncs building destruction to defense', () => {
    const building = makeBuilding({ name: 'Gold Storage', currentHp: 10, maxHp: 500 });
    const defense = makeDefense({
      buildingInstanceId: building.instanceId,
      currentHp: 10,
      maxHp: 500,
    });
    const goblin = makeTroop({
      name: 'Goblin',
      state: 'attacking',
      targetId: building.instanceId,
      dps: 20,
    });
    processTroopSpecial(goblin, [goblin], [building], [defense], 1000);
    expect(building.isDestroyed).toBe(true);
    expect(defense.isDestroyed).toBe(true);
    expect(defense.currentHp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Healer
// ---------------------------------------------------------------------------

describe('Healer', () => {
  it('heals ground troops within radius', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 5,
      x: 10,
      y: 10,
    });
    const barbarian = makeTroop({
      name: 'Barbarian',
      currentHp: 60,
      maxHp: 100,
      x: 12,
      y: 10,
      state: 'attacking',
    });
    processTroopSpecial(healer, [healer, barbarian], [], [], 1000);
    // 40 * 1 = 40 heal
    expect(barbarian.currentHp).toBe(100);
  });

  it('does not heal above maxHp', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 100,
      healRadius: 10,
      x: 10,
      y: 10,
    });
    const barbarian = makeTroop({
      name: 'Barbarian',
      currentHp: 95,
      maxHp: 100,
      x: 10,
      y: 10,
      state: 'attacking',
    });
    processTroopSpecial(healer, [healer, barbarian], [], [], 1000);
    expect(barbarian.currentHp).toBe(100);
  });

  it('heals heroes at 50% rate', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 10,
      x: 10,
      y: 10,
    });
    const hero = makeTroop({
      name: 'Barbarian King',
      currentHp: 200,
      maxHp: 300,
      x: 10,
      y: 10,
      state: 'attacking',
      isHero: true,
    });
    processTroopSpecial(healer, [healer, hero], [], [], 1000);
    // 40 * 0.5 = 20 heal
    expect(hero.currentHp).toBe(220);
  });

  it('does not heal itself', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 10,
      currentHp: 50,
      maxHp: 100,
      x: 10,
      y: 10,
    });
    processTroopSpecial(healer, [healer], [], [], 1000);
    expect(healer.currentHp).toBe(50);
  });

  it('does not heal other Healers (no chain healing)', () => {
    const healer1 = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 10,
      x: 10,
      y: 10,
    });
    const healer2 = makeTroop({
      name: 'Healer',
      isFlying: true,
      currentHp: 30,
      maxHp: 100,
      x: 10,
      y: 10,
    });
    processTroopSpecial(healer1, [healer1, healer2], [], [], 1000);
    expect(healer2.currentHp).toBe(30);
  });

  it('does not heal flying troops', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 10,
      x: 10,
      y: 10,
    });
    const dragon = makeTroop({
      name: 'Dragon',
      currentHp: 50,
      maxHp: 200,
      isFlying: true,
      x: 10,
      y: 10,
      state: 'attacking',
    });
    processTroopSpecial(healer, [healer, dragon], [], [], 1000);
    expect(dragon.currentHp).toBe(50);
  });

  it('skips troops with healingNerfed (Inferno Tower effect)', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 10,
      x: 10,
      y: 10,
    });
    const barbarian = makeTroop({
      name: 'Barbarian',
      currentHp: 50,
      maxHp: 100,
      x: 10,
      y: 10,
      state: 'attacking',
      healingNerfed: true,
    });
    processTroopSpecial(healer, [healer, barbarian], [], [], 1000);
    expect(barbarian.currentHp).toBe(50);
  });

  it('does not heal troops outside radius', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 3,
      x: 0,
      y: 0,
    });
    const barbarian = makeTroop({
      name: 'Barbarian',
      currentHp: 50,
      maxHp: 100,
      x: 10,
      y: 10,
      state: 'attacking',
    });
    processTroopSpecial(healer, [healer, barbarian], [], [], 1000);
    expect(barbarian.currentHp).toBe(50);
  });

  it('does not heal dead troops', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 10,
      x: 10,
      y: 10,
    });
    const deadTroop = makeTroop({
      name: 'Barbarian',
      currentHp: 0,
      maxHp: 100,
      x: 10,
      y: 10,
      state: 'dead',
    });
    processTroopSpecial(healer, [healer, deadTroop], [], [], 1000);
    expect(deadTroop.currentHp).toBe(0);
  });

  it('returns true (healers skip normal damage)', () => {
    const healer = makeTroop({
      name: 'Healer',
      isFlying: true,
      healPerSecond: 40,
      healRadius: 5,
    });
    const result = processTroopSpecial(healer, [healer], [], [], 1000);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Baby Dragon
// ---------------------------------------------------------------------------

describe('Baby Dragon', () => {
  it('enrages when no other air troops within 4.5 tiles', () => {
    const babyDragon = makeTroop({
      name: 'Baby Dragon',
      isFlying: true,
      baseDps: 50,
      dps: 50,
      isEnraged: false,
      x: 10,
      y: 10,
    });
    processTroopSpecial(babyDragon, [babyDragon], [], [], 1000);
    expect(babyDragon.isEnraged).toBe(true);
    expect(babyDragon.dps).toBe(100);
  });

  it('de-enrages when a nearby air troop is present', () => {
    const babyDragon = makeTroop({
      name: 'Baby Dragon',
      isFlying: true,
      baseDps: 50,
      dps: 100,
      isEnraged: true,
      x: 10,
      y: 10,
    });
    const dragon = makeTroop({
      name: 'Dragon',
      isFlying: true,
      x: 12,
      y: 10,
      state: 'attacking',
    });
    processTroopSpecial(babyDragon, [babyDragon, dragon], [], [], 1000);
    expect(babyDragon.isEnraged).toBe(false);
    expect(babyDragon.dps).toBe(50);
  });

  it('stays enraged when nearby troop is ground (not air)', () => {
    const babyDragon = makeTroop({
      name: 'Baby Dragon',
      isFlying: true,
      baseDps: 50,
      dps: 50,
      isEnraged: false,
      x: 10,
      y: 10,
    });
    const barbarian = makeTroop({
      name: 'Barbarian',
      isFlying: false,
      x: 10,
      y: 10,
      state: 'attacking',
    });
    processTroopSpecial(babyDragon, [babyDragon, barbarian], [], [], 1000);
    expect(babyDragon.isEnraged).toBe(true);
    expect(babyDragon.dps).toBe(100);
  });

  it('stays enraged when nearby air troop is dead', () => {
    const babyDragon = makeTroop({
      name: 'Baby Dragon',
      isFlying: true,
      baseDps: 50,
      dps: 50,
      isEnraged: false,
      x: 10,
      y: 10,
    });
    const deadDragon = makeTroop({
      name: 'Dragon',
      isFlying: true,
      x: 10,
      y: 10,
      state: 'dead',
    });
    processTroopSpecial(babyDragon, [babyDragon, deadDragon], [], [], 1000);
    expect(babyDragon.isEnraged).toBe(true);
  });

  it('returns false (uses normal attack with modified DPS)', () => {
    const babyDragon = makeTroop({
      name: 'Baby Dragon',
      isFlying: true,
      baseDps: 50,
      dps: 50,
    });
    const result = processTroopSpecial(babyDragon, [babyDragon], [], [], 1000);
    expect(result).toBe(false);
  });

  it('does not toggle enrage if already enraged and still alone', () => {
    const babyDragon = makeTroop({
      name: 'Baby Dragon',
      isFlying: true,
      baseDps: 50,
      dps: 100,
      isEnraged: true,
      x: 10,
      y: 10,
    });
    processTroopSpecial(babyDragon, [babyDragon], [], [], 1000);
    // Should stay enraged, DPS should remain doubled
    expect(babyDragon.isEnraged).toBe(true);
    expect(babyDragon.dps).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 6. Miner
// ---------------------------------------------------------------------------

describe('Miner', () => {
  it('sets isBurrowed to true when moving', () => {
    const miner = makeTroop({ name: 'Miner', state: 'moving' });
    processTroopSpecial(miner, [miner], [], [], 1000);
    expect(miner.isBurrowed).toBe(true);
  });

  it('sets isBurrowed to false when idle', () => {
    const miner = makeTroop({ name: 'Miner', state: 'idle', isBurrowed: true });
    processTroopSpecial(miner, [miner], [], [], 1000);
    expect(miner.isBurrowed).toBe(false);
  });

  it('sets isBurrowed to false when attacking', () => {
    const miner = makeTroop({ name: 'Miner', state: 'attacking', isBurrowed: true });
    processTroopSpecial(miner, [miner], [], [], 1000);
    expect(miner.isBurrowed).toBe(false);
  });

  it('does nothing when dead', () => {
    const miner = makeTroop({ name: 'Miner', state: 'dead', isBurrowed: true });
    processTroopSpecial(miner, [miner], [], [], 1000);
    // When dead, the function returns early, so isBurrowed stays as-is
    expect(miner.isBurrowed).toBe(true);
  });

  it('returns false (normal attack, no special damage handling)', () => {
    const miner = makeTroop({ name: 'Miner', state: 'moving' });
    const result = processTroopSpecial(miner, [miner], [], [], 1000);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Electro Dragon
// ---------------------------------------------------------------------------

describe('Electro Dragon', () => {
  it('chains to nearby buildings with damage decay', () => {
    const primary = makeBuilding({ name: 'Cannon', currentHp: 1000, maxHp: 1000, x: 10, y: 10 });
    const chain1 = makeBuilding({ name: 'Archer Tower', currentHp: 1000, maxHp: 1000, x: 12, y: 10 });
    const chain2 = makeBuilding({ name: 'Mortar', currentHp: 1000, maxHp: 1000, x: 14, y: 10 });

    const edrag = makeTroop({
      name: 'Electro Dragon',
      state: 'attacking',
      targetId: primary.instanceId,
      dps: 100,
      baseDps: 100,
      isFlying: true,
      chainTargets: 4,
      chainDamageDecay: 0.75,
      x: 8,
      y: 10,
    });

    processTroopSpecial(edrag, [edrag], [primary, chain1, chain2], [], 1000);

    // Primary building: untouched by chain (handled by normal processTroop)
    expect(primary.currentHp).toBe(1000);

    // chain1 gets: 100 * 0.75 = 75 damage
    expect(chain1.currentHp).toBe(925);

    // chain2 gets: 75 * 0.75 = 56.25 damage
    expect(chain2.currentHp).toBe(1000 - 56.25);
  });

  it('returns true when attacking', () => {
    const target = makeBuilding({ name: 'Cannon', currentHp: 1000, maxHp: 1000, x: 10, y: 10 });
    const chain1 = makeBuilding({ name: 'Mortar', currentHp: 1000, maxHp: 1000, x: 12, y: 10 });

    const edrag = makeTroop({
      name: 'Electro Dragon',
      state: 'attacking',
      targetId: target.instanceId,
      dps: 100,
      isFlying: true,
      chainTargets: 4,
      chainDamageDecay: 0.75,
    });

    const result = processTroopSpecial(edrag, [edrag], [target, chain1], [], 1000);
    expect(result).toBe(true);
  });

  it('returns false when not attacking', () => {
    const edrag = makeTroop({
      name: 'Electro Dragon',
      state: 'moving',
      isFlying: true,
      chainTargets: 4,
    });
    const result = processTroopSpecial(edrag, [edrag], [], [], 1000);
    expect(result).toBe(false);
  });

  it('skips destroyed buildings during chain', () => {
    const primary = makeBuilding({ name: 'Cannon', currentHp: 1000, maxHp: 1000, x: 10, y: 10 });
    const destroyed = makeBuilding({
      name: 'Mortar',
      currentHp: 0,
      maxHp: 500,
      x: 12,
      y: 10,
      isDestroyed: true,
    });
    const alive = makeBuilding({ name: 'Wizard Tower', currentHp: 1000, maxHp: 1000, x: 13, y: 10 });

    const edrag = makeTroop({
      name: 'Electro Dragon',
      state: 'attacking',
      targetId: primary.instanceId,
      dps: 100,
      isFlying: true,
      chainTargets: 4,
      chainDamageDecay: 0.75,
    });

    processTroopSpecial(edrag, [edrag], [primary, destroyed, alive], [], 1000);

    // Destroyed building should remain at 0
    expect(destroyed.currentHp).toBe(0);
    // alive gets chained to (skipping destroyed)
    expect(alive.currentHp).toBeLessThan(1000);
  });

  it('stops chain when no more nearby buildings', () => {
    const primary = makeBuilding({ name: 'Cannon', currentHp: 1000, maxHp: 1000, x: 10, y: 10 });
    // No other buildings nearby (far away)
    const farBuilding = makeBuilding({
      name: 'Barracks',
      currentHp: 1000,
      maxHp: 1000,
      x: 100,
      y: 100,
    });

    const edrag = makeTroop({
      name: 'Electro Dragon',
      state: 'attacking',
      targetId: primary.instanceId,
      dps: 100,
      isFlying: true,
      chainTargets: 4,
      chainDamageDecay: 0.75,
    });

    processTroopSpecial(edrag, [edrag], [primary, farBuilding], [], 1000);

    // Far building should be untouched
    expect(farBuilding.currentHp).toBe(1000);
  });

  it('chains up to the specified number of targets', () => {
    const primary = makeBuilding({ name: 'Cannon', currentHp: 1000, maxHp: 1000, x: 10, y: 10 });
    const b1 = makeBuilding({ name: 'Tower 1', currentHp: 1000, maxHp: 1000, x: 12, y: 10 });
    const b2 = makeBuilding({ name: 'Tower 2', currentHp: 1000, maxHp: 1000, x: 14, y: 10 });
    const b3 = makeBuilding({ name: 'Tower 3', currentHp: 1000, maxHp: 1000, x: 16, y: 10 });

    const edrag = makeTroop({
      name: 'Electro Dragon',
      state: 'attacking',
      targetId: primary.instanceId,
      dps: 100,
      isFlying: true,
      chainTargets: 2, // Only 2 bounces
      chainDamageDecay: 0.75,
    });

    processTroopSpecial(edrag, [edrag], [primary, b1, b2, b3], [], 1000);

    expect(b1.currentHp).toBeLessThan(1000);
    expect(b2.currentHp).toBeLessThan(1000);
    // b3 should be untouched since chainTargets is 2
    expect(b3.currentHp).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// 8. Valkyrie
// ---------------------------------------------------------------------------

describe('Valkyrie', () => {
  it('deals splash damage to all buildings within splashRadius', () => {
    const b1 = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500, x: 10, y: 10 });
    const b2 = makeBuilding({ name: 'Mortar', currentHp: 500, maxHp: 500, x: 10.5, y: 10 });
    const farBuilding = makeBuilding({ name: 'Barracks', currentHp: 500, maxHp: 500, x: 30, y: 30 });

    const valk = makeTroop({
      name: 'Valkyrie',
      state: 'attacking',
      targetId: b1.instanceId,
      dps: 100,
      x: 10,
      y: 10,
      splashRadius: 1,
    });

    processTroopSpecial(valk, [valk], [b1, b2, farBuilding], [], 1000);

    // Both nearby buildings should take 100 damage
    expect(b1.currentHp).toBe(400);
    expect(b2.currentHp).toBe(400);
    // Far building should be untouched
    expect(farBuilding.currentHp).toBe(500);
  });

  it('returns true when attacking', () => {
    const b1 = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500, x: 10, y: 10 });
    const valk = makeTroop({
      name: 'Valkyrie',
      state: 'attacking',
      targetId: b1.instanceId,
      dps: 50,
      x: 10,
      y: 10,
      splashRadius: 1,
    });
    const result = processTroopSpecial(valk, [valk], [b1], [], 1000);
    expect(result).toBe(true);
  });

  it('returns false when not attacking', () => {
    const valk = makeTroop({
      name: 'Valkyrie',
      state: 'moving',
      splashRadius: 1,
    });
    const result = processTroopSpecial(valk, [valk], [], [], 1000);
    expect(result).toBe(false);
  });

  it('destroys buildings and syncs defense destruction', () => {
    const b1 = makeBuilding({ name: 'Cannon', currentHp: 50, maxHp: 500, x: 10, y: 10 });
    const def = makeDefense({
      buildingInstanceId: b1.instanceId,
      currentHp: 50,
      maxHp: 500,
      x: 10,
      y: 10,
    });
    const valk = makeTroop({
      name: 'Valkyrie',
      state: 'attacking',
      targetId: b1.instanceId,
      dps: 100,
      x: 10,
      y: 10,
      splashRadius: 1,
    });

    processTroopSpecial(valk, [valk], [b1], [def], 1000);

    expect(b1.currentHp).toBe(0);
    expect(b1.isDestroyed).toBe(true);
    expect(def.isDestroyed).toBe(true);
    expect(def.currentHp).toBe(0);
  });

  it('skips already destroyed buildings', () => {
    const destroyed = makeBuilding({
      name: 'Cannon',
      currentHp: 0,
      maxHp: 500,
      x: 10,
      y: 10,
      isDestroyed: true,
    });
    const valk = makeTroop({
      name: 'Valkyrie',
      state: 'attacking',
      targetId: destroyed.instanceId,
      dps: 100,
      x: 10,
      y: 10,
      splashRadius: 1,
    });

    processTroopSpecial(valk, [valk], [destroyed], [], 1000);
    expect(destroyed.currentHp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. processDeathSpawns
// ---------------------------------------------------------------------------

describe('processDeathSpawns', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('returns correct number of spawns for Golem', () => {
    const golem = makeTroop({
      name: 'Golem',
      maxHp: 5000,
      baseDps: 40,
      level: 5,
      x: 15,
      y: 15,
      deathSpawnName: 'Golemite',
      deathSpawnCount: 2,
      attackRange: 1,
      movementSpeed: 12,
      isFlying: false,
    });
    const spawns = processDeathSpawns(golem);
    expect(spawns).toHaveLength(2);
  });

  it('sets spawn HP to 20% of parent maxHp', () => {
    const golem = makeTroop({
      name: 'Golem',
      maxHp: 5000,
      baseDps: 40,
      deathSpawnName: 'Golemite',
      deathSpawnCount: 2,
    });
    const spawns = processDeathSpawns(golem);
    // Math.floor(5000 * 0.2) = 1000
    expect(spawns[0].currentHp).toBe(1000);
    expect(spawns[0].maxHp).toBe(1000);
  });

  it('sets spawn DPS to 30% of parent baseDps', () => {
    const golem = makeTroop({
      name: 'Golem',
      maxHp: 5000,
      baseDps: 40,
      deathSpawnName: 'Golemite',
      deathSpawnCount: 2,
    });
    const spawns = processDeathSpawns(golem);
    // Math.floor(40 * 0.3) = 12
    expect(spawns[0].dps).toBe(12);
    expect(spawns[0].baseDps).toBe(12);
  });

  it('spawns inherit the correct name', () => {
    const lavaHound = makeTroop({
      name: 'Lava Hound',
      maxHp: 6000,
      baseDps: 10,
      deathSpawnName: 'Lava Pup',
      deathSpawnCount: 8,
      isFlying: true,
    });
    const spawns = processDeathSpawns(lavaHound);
    expect(spawns).toHaveLength(8);
    for (const s of spawns) {
      expect(s.name).toBe('Lava Pup');
    }
  });

  it('spawns inherit parent level', () => {
    const golem = makeTroop({
      name: 'Golem',
      level: 7,
      maxHp: 5000,
      baseDps: 40,
      deathSpawnName: 'Golemite',
      deathSpawnCount: 2,
    });
    const spawns = processDeathSpawns(golem);
    for (const s of spawns) {
      expect(s.level).toBe(7);
    }
  });

  it('spawns inherit parent isFlying flag', () => {
    const lavaHound = makeTroop({
      name: 'Lava Hound',
      maxHp: 6000,
      baseDps: 10,
      deathSpawnName: 'Lava Pup',
      deathSpawnCount: 4,
      isFlying: true,
    });
    const spawns = processDeathSpawns(lavaHound);
    for (const s of spawns) {
      expect(s.isFlying).toBe(true);
    }
  });

  it('spawns are positioned near the parent with offset', () => {
    // Math.random mocked to 0.5, so (0.5 - 0.5) * 2 = 0 offset
    const golem = makeTroop({
      name: 'Golem',
      maxHp: 5000,
      baseDps: 40,
      x: 20,
      y: 25,
      deathSpawnName: 'Golemite',
      deathSpawnCount: 1,
    });
    const spawns = processDeathSpawns(golem);
    expect(spawns[0].x).toBe(20); // 20 + 0
    expect(spawns[0].y).toBe(25); // 25 + 0
  });

  it('spawns have unique IDs based on parent ID', () => {
    const golem = makeTroop({
      name: 'Golem',
      maxHp: 5000,
      baseDps: 40,
      deathSpawnName: 'Golemite',
      deathSpawnCount: 3,
    });
    const spawns = processDeathSpawns(golem);
    const ids = spawns.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toContain(golem.id);
    }
  });

  it('spawns start in idle state with no target', () => {
    const golem = makeTroop({
      name: 'Golem',
      maxHp: 5000,
      baseDps: 40,
      deathSpawnName: 'Golemite',
      deathSpawnCount: 2,
    });
    const spawns = processDeathSpawns(golem);
    for (const s of spawns) {
      expect(s.state).toBe('idle');
      expect(s.targetId).toBeNull();
    }
  });

  it('returns empty array if no deathSpawnName', () => {
    const troop = makeTroop({ name: 'Barbarian' });
    const spawns = processDeathSpawns(troop);
    expect(spawns).toEqual([]);
  });

  it('returns empty array if deathSpawnCount is 0', () => {
    const troop = makeTroop({
      name: 'Golem',
      deathSpawnName: 'Golemite',
      deathSpawnCount: 0,
    });
    const spawns = processDeathSpawns(troop);
    expect(spawns).toEqual([]);
  });

  it('returns empty array if deathSpawnCount is undefined', () => {
    const troop = makeTroop({
      name: 'Golem',
      deathSpawnName: 'Golemite',
    });
    const spawns = processDeathSpawns(troop);
    expect(spawns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. processDeathDamage
// ---------------------------------------------------------------------------

describe('processDeathDamage', () => {
  it('deals area damage to buildings in radius', () => {
    const b1 = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500, x: 10, y: 10 });
    const b2 = makeBuilding({ name: 'Mortar', currentHp: 500, maxHp: 500, x: 11, y: 10 });
    const balloon = makeTroop({
      name: 'Balloon',
      x: 10,
      y: 10,
      state: 'dead',
      deathDamage: 200,
      deathDamageRadius: 2,
    });

    processDeathDamage(balloon, [b1, b2], []);

    expect(b1.currentHp).toBe(300);
    expect(b2.currentHp).toBe(300);
  });

  it('does not damage buildings outside the radius', () => {
    const nearBuilding = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500, x: 10, y: 10 });
    const farBuilding = makeBuilding({ name: 'Barracks', currentHp: 500, maxHp: 500, x: 50, y: 50 });
    const balloon = makeTroop({
      name: 'Balloon',
      x: 10,
      y: 10,
      deathDamage: 200,
      deathDamageRadius: 3,
    });

    processDeathDamage(balloon, [nearBuilding, farBuilding], []);

    expect(nearBuilding.currentHp).toBe(300);
    expect(farBuilding.currentHp).toBe(500);
  });

  it('destroys buildings when damage exceeds HP', () => {
    const building = makeBuilding({ name: 'Cannon', currentHp: 50, maxHp: 500, x: 10, y: 10 });
    const balloon = makeTroop({
      name: 'Balloon',
      x: 10,
      y: 10,
      deathDamage: 200,
      deathDamageRadius: 3,
    });

    processDeathDamage(balloon, [building], []);

    expect(building.currentHp).toBe(0);
    expect(building.isDestroyed).toBe(true);
  });

  it('syncs destroyed buildings to matching defenses', () => {
    const building = makeBuilding({ name: 'Cannon', currentHp: 50, maxHp: 500, x: 10, y: 10 });
    const defense = makeDefense({
      buildingInstanceId: building.instanceId,
      currentHp: 50,
      maxHp: 500,
      x: 10,
      y: 10,
    });
    const balloon = makeTroop({
      name: 'Balloon',
      x: 10,
      y: 10,
      deathDamage: 200,
      deathDamageRadius: 3,
    });

    processDeathDamage(balloon, [building], [defense]);

    expect(defense.isDestroyed).toBe(true);
    expect(defense.currentHp).toBe(0);
  });

  it('does nothing if deathDamage is not set', () => {
    const building = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500, x: 10, y: 10 });
    const troop = makeTroop({ name: 'Barbarian', x: 10, y: 10 });

    processDeathDamage(troop, [building], []);

    expect(building.currentHp).toBe(500);
  });

  it('does nothing if deathDamageRadius is not set', () => {
    const building = makeBuilding({ name: 'Cannon', currentHp: 500, maxHp: 500, x: 10, y: 10 });
    const troop = makeTroop({ name: 'Balloon', x: 10, y: 10, deathDamage: 200 });

    processDeathDamage(troop, [building], []);

    expect(building.currentHp).toBe(500);
  });

  it('skips already destroyed buildings', () => {
    const destroyed = makeBuilding({
      name: 'Cannon',
      currentHp: 0,
      maxHp: 500,
      x: 10,
      y: 10,
      isDestroyed: true,
    });
    const balloon = makeTroop({
      name: 'Balloon',
      x: 10,
      y: 10,
      deathDamage: 200,
      deathDamageRadius: 3,
    });

    processDeathDamage(balloon, [destroyed], []);

    expect(destroyed.currentHp).toBe(0);
  });

  it('clamps building HP to zero (not negative)', () => {
    const building = makeBuilding({ name: 'Cannon', currentHp: 10, maxHp: 500, x: 10, y: 10 });
    const balloon = makeTroop({
      name: 'Balloon',
      x: 10,
      y: 10,
      deathDamage: 9999,
      deathDamageRadius: 5,
    });

    processDeathDamage(balloon, [building], []);

    expect(building.currentHp).toBe(0);
    expect(building.isDestroyed).toBe(true);
  });
});
