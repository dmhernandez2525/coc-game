import { describe, it, expect } from 'vitest';
import type { ActiveDefense, DeployedTroop } from '../../types/battle.ts';
import { processDefenseSpecial, processBombTowerDeath } from '../defense-behaviors.ts';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeDefense(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
  return {
    buildingInstanceId: 'def-1',
    name: 'Archer Tower',
    level: 10,
    currentHp: 1000,
    maxHp: 1000,
    x: 20,
    y: 20,
    targetTroopId: null,
    dps: 100,
    baseDps: 100,
    range: { min: 0, max: 10 },
    attackSpeed: 1,
    lastAttackTime: 0,
    isDestroyed: false,
    ...overrides,
  };
}

function makeTroop(overrides: Partial<DeployedTroop> = {}): DeployedTroop {
  return {
    id: 'troop-1',
    name: 'Barbarian',
    level: 7,
    currentHp: 500,
    maxHp: 500,
    x: 22,
    y: 22,
    targetId: null,
    state: 'moving',
    dps: 50,
    baseDps: 50,
    attackRange: 1,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<Parameters<typeof processDefenseSpecial>[1]> = {}) {
  return {
    troops: [] as DeployedTroop[],
    elapsed: 5,
    deltaMs: 1000,
    destructionPercent: 0,
    totalHousingDeployed: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// processDefenseSpecial - Freeze handling
// ---------------------------------------------------------------------------

describe('processDefenseSpecial - freeze handling', () => {
  it('returns true and skips processing when defense is frozen and elapsed < frozenUntil', () => {
    const troop = makeTroop({ x: 22, y: 22, currentHp: 500 });
    const defense = makeDefense({
      name: 'Inferno Tower',
      infernoMode: 'single',
      isFrozen: true,
      frozenUntil: 10,
      baseDps: 100,
    });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    const result = processDefenseSpecial(defense, ctx);

    expect(result).toBe(true);
    expect(troop.currentHp).toBe(500); // no damage dealt
    expect(defense.isFrozen).toBe(true);
  });

  it('unfreezes and processes normally when elapsed >= frozenUntil', () => {
    const troop = makeTroop({ x: 22, y: 22, currentHp: 500 });
    const defense = makeDefense({
      name: 'Inferno Tower',
      infernoMode: 'single',
      isFrozen: true,
      frozenUntil: 5,
      baseDps: 100,
    });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    const result = processDefenseSpecial(defense, ctx);

    expect(result).toBe(true);
    expect(defense.isFrozen).toBe(false);
    expect(defense.frozenUntil).toBeUndefined();
    // After unfreezing the inferno should deal damage
    expect(troop.currentHp).toBeLessThan(500);
  });

  it('does not unfreeze when isFrozen is true but frozenUntil is undefined', () => {
    // When frozenUntil is undefined the outer condition fails, so the defense
    // is NOT treated as frozen by processDefenseSpecial and the handler runs.
    const troop = makeTroop({ x: 22, y: 22, currentHp: 500 });
    const defense = makeDefense({
      name: 'Inferno Tower',
      infernoMode: 'single',
      isFrozen: true,
      baseDps: 100,
    });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    // isFrozen without frozenUntil: processDefenseSpecial skips the freeze
    // block, but the inferno handler itself checks isFrozen and bails out.
    const result = processDefenseSpecial(defense, ctx);
    expect(result).toBe(true);
    expect(troop.currentHp).toBe(500); // handler skips because isFrozen
  });

  it('unfreezes exactly at the boundary (elapsed === frozenUntil)', () => {
    const defense = makeDefense({
      name: 'Mortar',
      isFrozen: true,
      frozenUntil: 7,
      splashRadius: 1.5,
    });
    const ctx = makeCtx({ elapsed: 7 });

    processDefenseSpecial(defense, ctx);

    expect(defense.isFrozen).toBe(false);
    expect(defense.frozenUntil).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// processDefenseSpecial - returns false for unknown/standard defense names
// ---------------------------------------------------------------------------

describe('processDefenseSpecial - unknown defense names', () => {
  it('returns false for Archer Tower (standard defense)', () => {
    const defense = makeDefense({ name: 'Archer Tower' });
    const ctx = makeCtx();
    expect(processDefenseSpecial(defense, ctx)).toBe(false);
  });

  it('returns false for Cannon', () => {
    const defense = makeDefense({ name: 'Cannon' });
    const ctx = makeCtx();
    expect(processDefenseSpecial(defense, ctx)).toBe(false);
  });

  it('returns false for Wizard Tower', () => {
    const defense = makeDefense({ name: 'Wizard Tower' });
    const ctx = makeCtx();
    expect(processDefenseSpecial(defense, ctx)).toBe(false);
  });

  it('returns false for X-Bow', () => {
    const defense = makeDefense({ name: 'X-Bow' });
    const ctx = makeCtx();
    expect(processDefenseSpecial(defense, ctx)).toBe(false);
  });

  it('returns true for all known special defenses', () => {
    const specialNames = ['Inferno Tower', 'Hidden Tesla', 'Eagle Artillery', 'Mortar', 'Air Sweeper'];
    for (const name of specialNames) {
      const defense = makeDefense({ name });
      const ctx = makeCtx();
      expect(processDefenseSpecial(defense, ctx)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Inferno Tower (Single Target)
// ---------------------------------------------------------------------------

describe('Inferno Tower - single target', () => {
  function makeInfernoSingle(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
    return makeDefense({
      name: 'Inferno Tower',
      infernoMode: 'single',
      baseDps: 50,
      dps: 50,
      range: { min: 0, max: 10 },
      ...overrides,
    });
  }

  it('deals damage that ramps up over time', () => {
    const troop = makeTroop({ currentHp: 10000, maxHp: 10000 });
    const defense = makeInfernoSingle();

    // First tick: 1 second at ramp fraction = 0.5s/2s = 0.5 (after adding 1s)
    // rampMultiplier at t=1: 1 + 4*(1/2) = 3, damage = 50*3*1 = 150
    const ctx1 = makeCtx({ troops: [troop], elapsed: 1, deltaMs: 1000 });
    processDefenseSpecial(defense, ctx1);
    const hpAfterFirst = troop.currentHp;
    expect(hpAfterFirst).toBeLessThan(10000);
    const firstDamage = 10000 - hpAfterFirst;

    // Second tick: another second, rampTime now 2s, fraction capped at 1
    // rampMultiplier = 5, damage = 50*5*1 = 250
    const ctx2 = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000 });
    processDefenseSpecial(defense, ctx2);
    const secondDamage = hpAfterFirst - troop.currentHp;

    expect(secondDamage).toBeGreaterThan(firstDamage);
  });

  it('caps ramp multiplier at 5x after the ramp duration', () => {
    const troop = makeTroop({ currentHp: 100000, maxHp: 100000 });
    const defense = makeInfernoSingle({ baseDps: 100 });

    // Tick 1: 3 seconds, exceeds 2-second ramp duration
    const ctx1 = makeCtx({ troops: [troop], elapsed: 3, deltaMs: 3000 });
    processDefenseSpecial(defense, ctx1);
    // infernoRampTime = 3s, fraction = min(3/2, 1) = 1, multiplier = 5
    // damage = 100 * 5 * 3 = 1500
    expect(troop.currentHp).toBe(100000 - 1500);

    // Another tick at 1s: still max ramp
    const ctx2 = makeCtx({ troops: [troop], elapsed: 4, deltaMs: 1000 });
    processDefenseSpecial(defense, ctx2);
    // rampTime = 4, fraction still capped at 1, multiplier = 5, damage = 500
    expect(troop.currentHp).toBe(100000 - 1500 - 500);
  });

  it('sets healingNerfed on the target', () => {
    const troop = makeTroop({ currentHp: 5000, maxHp: 5000, healingNerfed: false });
    const defense = makeInfernoSingle();
    const ctx = makeCtx({ troops: [troop], elapsed: 1, deltaMs: 500 });

    processDefenseSpecial(defense, ctx);

    expect(troop.healingNerfed).toBe(true);
  });

  it('resets ramp time when target is killed', () => {
    const troop = makeTroop({ currentHp: 10, maxHp: 500 });
    const defense = makeInfernoSingle({ baseDps: 200, infernoRampTime: 1.5 });
    const ctx = makeCtx({ troops: [troop], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.state).toBe('dead');
    expect(troop.currentHp).toBe(0);
    expect(defense.targetTroopId).toBeNull();
    expect(defense.infernoRampTime).toBe(0);
  });

  it('resets ramp time when no target is available', () => {
    const defense = makeInfernoSingle({ infernoRampTime: 1.5 });
    // No troops at all
    const ctx = makeCtx({ troops: [], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(defense.infernoRampTime).toBe(0);
  });

  it('skips processing when destroyed', () => {
    const troop = makeTroop({ currentHp: 500 });
    const defense = makeInfernoSingle({ isDestroyed: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(500);
  });

  it('skips processing when frozen (via handler internal check)', () => {
    const troop = makeTroop({ currentHp: 500 });
    // isFrozen true but no frozenUntil, so processDefenseSpecial freeze block
    // is skipped but the handler itself checks isFrozen.
    const defense = makeInfernoSingle({ isFrozen: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(500);
  });

  it('retargets when current target dies between ticks', () => {
    const deadTroop = makeTroop({ id: 'troop-dead', currentHp: 0, state: 'dead', x: 22, y: 22 });
    const aliveTroop = makeTroop({ id: 'troop-alive', currentHp: 1000, maxHp: 1000, x: 23, y: 23 });
    const defense = makeInfernoSingle({ targetTroopId: 'troop-dead', infernoRampTime: 1.0 });
    const ctx = makeCtx({ troops: [deadTroop, aliveTroop], elapsed: 2, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    // Should have retargeted to the alive troop and dealt damage
    expect(aliveTroop.currentHp).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Inferno Tower (Multi Target)
// ---------------------------------------------------------------------------

describe('Inferno Tower - multi target', () => {
  function makeInfernoMulti(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
    return makeDefense({
      name: 'Inferno Tower',
      infernoMode: 'multi',
      baseDps: 40,
      dps: 40,
      range: { min: 0, max: 10 },
      ...overrides,
    });
  }

  it('hits up to 5 targets simultaneously', () => {
    const troops = Array.from({ length: 7 }, (_, i) =>
      makeTroop({ id: `t-${i}`, currentHp: 1000, maxHp: 1000, x: 21 + i * 0.5, y: 21 }),
    );
    const defense = makeInfernoMulti();
    const ctx = makeCtx({ troops, elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    const damaged = troops.filter((t) => t.currentHp < 1000);
    expect(damaged.length).toBe(5);
  });

  it('targets the closest troops first', () => {
    const closeTroop = makeTroop({ id: 'close', x: 21, y: 20, currentHp: 1000 });
    const farTroop = makeTroop({ id: 'far', x: 29, y: 20, currentHp: 1000 });
    const outOfRange = makeTroop({ id: 'oor', x: 50, y: 50, currentHp: 1000 });
    const defense = makeInfernoMulti({ infernoMaxTargets: 2 });
    const ctx = makeCtx({ troops: [outOfRange, farTroop, closeTroop], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(closeTroop.currentHp).toBeLessThan(1000);
    expect(farTroop.currentHp).toBeLessThan(1000);
    expect(outOfRange.currentHp).toBe(1000); // out of range
  });

  it('respects custom infernoMaxTargets', () => {
    const troops = Array.from({ length: 5 }, (_, i) =>
      makeTroop({ id: `t-${i}`, currentHp: 1000, maxHp: 1000, x: 21 + i, y: 20 }),
    );
    const defense = makeInfernoMulti({ infernoMaxTargets: 3 });
    const ctx = makeCtx({ troops, elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    const damaged = troops.filter((t) => t.currentHp < 1000);
    expect(damaged.length).toBe(3);
  });

  it('kills troops that reach 0 HP', () => {
    const weakTroop = makeTroop({ id: 'weak', currentHp: 10, maxHp: 500, x: 21, y: 20 });
    const defense = makeInfernoMulti({ baseDps: 100 });
    const ctx = makeCtx({ troops: [weakTroop], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(weakTroop.state).toBe('dead');
    expect(weakTroop.currentHp).toBe(0);
  });

  it('skips destroyed defense', () => {
    const troop = makeTroop({ currentHp: 1000 });
    const defense = makeInfernoMulti({ isDestroyed: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(1000);
  });

  it('skips frozen defense', () => {
    const troop = makeTroop({ currentHp: 1000 });
    const defense = makeInfernoMulti({ isFrozen: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(1000);
  });

  it('ignores dead troops', () => {
    const dead = makeTroop({ id: 'dead-t', currentHp: 0, state: 'dead', x: 21, y: 20 });
    const alive = makeTroop({ id: 'alive-t', currentHp: 1000, x: 22, y: 20 });
    const defense = makeInfernoMulti();
    const ctx = makeCtx({ troops: [dead, alive], elapsed: 1, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(dead.currentHp).toBe(0);
    expect(alive.currentHp).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// Hidden Tesla
// ---------------------------------------------------------------------------

describe('Hidden Tesla', () => {
  function makeTesla(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
    return makeDefense({
      name: 'Hidden Tesla',
      isHidden: true,
      revealTriggerRange: 6,
      dps: 80,
      baseDps: 80,
      range: { min: 0, max: 7 },
      attackSpeed: 0.6,
      lastAttackTime: 0,
      ...overrides,
    });
  }

  it('stays hidden when no troops are nearby and destruction < 51%', () => {
    const troop = makeTroop({ x: 50, y: 50 }); // far away
    const defense = makeTesla();
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 20 });

    processDefenseSpecial(defense, ctx);

    expect(defense.isHidden).toBe(true);
    expect(troop.currentHp).toBe(500); // no damage
  });

  it('reveals when a troop is within revealTriggerRange', () => {
    const troop = makeTroop({ x: 24, y: 20 }); // 4 tiles away, within 6 range
    const defense = makeTesla();
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 0 });

    processDefenseSpecial(defense, ctx);

    expect(defense.isHidden).toBe(false);
  });

  it('reveals at 51% destruction even without troops nearby', () => {
    const troop = makeTroop({ x: 100, y: 100 }); // very far
    const defense = makeTesla();
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 51 });

    processDefenseSpecial(defense, ctx);

    expect(defense.isHidden).toBe(false);
  });

  it('does not reveal at 50% destruction (threshold is >= 51)', () => {
    const troop = makeTroop({ x: 100, y: 100 });
    const defense = makeTesla();
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 50 });

    processDefenseSpecial(defense, ctx);

    expect(defense.isHidden).toBe(true);
  });

  it('attacks after reveal when cooldown has passed', () => {
    const troop = makeTroop({ x: 22, y: 20, currentHp: 1000, maxHp: 1000 });
    const defense = makeTesla({ isHidden: false, lastAttackTime: 0, attackSpeed: 0.6 });
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBeLessThan(1000);
  });

  it('does not attack while still hidden', () => {
    const troop = makeTroop({ x: 50, y: 50, currentHp: 1000 });
    const defense = makeTesla();
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 0 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(1000);
  });

  it('skips when destroyed', () => {
    const troop = makeTroop({ x: 21, y: 20, currentHp: 1000 });
    const defense = makeTesla({ isDestroyed: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 100 });

    processDefenseSpecial(defense, ctx);

    expect(defense.isHidden).toBe(true); // unchanged
    expect(troop.currentHp).toBe(1000);
  });

  it('skips when frozen', () => {
    const troop = makeTroop({ x: 21, y: 20, currentHp: 1000 });
    const defense = makeTesla({ isFrozen: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 100 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(1000);
  });

  it('uses custom revealTriggerRange', () => {
    const troop = makeTroop({ x: 23, y: 20 }); // 3 tiles away
    const defense = makeTesla({ revealTriggerRange: 2 }); // only 2 tiles

    const ctx = makeCtx({ troops: [troop], elapsed: 2, deltaMs: 1000, destructionPercent: 0 });
    processDefenseSpecial(defense, ctx);

    expect(defense.isHidden).toBe(true); // troop at 3 tiles, range is 2
  });
});

// ---------------------------------------------------------------------------
// Eagle Artillery
// ---------------------------------------------------------------------------

describe('Eagle Artillery', () => {
  function makeEagle(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
    return makeDefense({
      name: 'Eagle Artillery',
      dps: 300,
      baseDps: 300,
      range: { min: 7, max: 50 },
      attackSpeed: 10,
      lastAttackTime: -10,
      eagleActivated: false,
      eagleActivationThreshold: 200,
      ...overrides,
    });
  }

  it('remains inactive when housing deployed is below threshold', () => {
    const troop = makeTroop({ x: 40, y: 40, currentHp: 5000 });
    const defense = makeEagle();
    const ctx = makeCtx({ troops: [troop], elapsed: 15, deltaMs: 1000, totalHousingDeployed: 100 });

    processDefenseSpecial(defense, ctx);

    expect(defense.eagleActivated).toBe(false);
    expect(troop.currentHp).toBe(5000);
  });

  it('activates at the threshold', () => {
    const troop = makeTroop({ x: 40, y: 40, currentHp: 5000 });
    const defense = makeEagle({ lastAttackTime: 0 });
    const ctx = makeCtx({ troops: [troop], elapsed: 15, deltaMs: 1000, totalHousingDeployed: 200 });

    processDefenseSpecial(defense, ctx);

    expect(defense.eagleActivated).toBe(true);
    // Should deal damage because cooldown has passed (15 - 0 >= 10)
    expect(troop.currentHp).toBeLessThan(5000);
  });

  it('attacks when already activated', () => {
    const troop = makeTroop({ x: 40, y: 40, currentHp: 5000 });
    const defense = makeEagle({ eagleActivated: true, lastAttackTime: 0 });
    const ctx = makeCtx({ troops: [troop], elapsed: 15, deltaMs: 1000, totalHousingDeployed: 300 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBeLessThan(5000);
  });

  it('uses custom activation threshold', () => {
    const troop = makeTroop({ x: 40, y: 40, currentHp: 5000 });
    const defense = makeEagle({ eagleActivationThreshold: 150 });
    const ctx = makeCtx({ troops: [troop], elapsed: 15, deltaMs: 1000, totalHousingDeployed: 160 });

    processDefenseSpecial(defense, ctx);

    expect(defense.eagleActivated).toBe(true);
  });

  it('skips when destroyed', () => {
    const troop = makeTroop({ x: 40, y: 40, currentHp: 5000 });
    const defense = makeEagle({ isDestroyed: true, eagleActivated: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 15, deltaMs: 1000, totalHousingDeployed: 300 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(5000);
  });

  it('skips when frozen', () => {
    const troop = makeTroop({ x: 40, y: 40, currentHp: 5000 });
    const defense = makeEagle({ isFrozen: true, eagleActivated: true });
    const ctx = makeCtx({ troops: [troop], elapsed: 15, deltaMs: 1000, totalHousingDeployed: 300 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Mortar
// ---------------------------------------------------------------------------

describe('Mortar', () => {
  function makeMortar(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
    return makeDefense({
      name: 'Mortar',
      dps: 40,
      baseDps: 40,
      range: { min: 4, max: 11 },
      attackSpeed: 5,
      lastAttackTime: -5,
      splashRadius: 1.5,
      ...overrides,
    });
  }

  it('deals splash damage to nearby ground troops', () => {
    const primary = makeTroop({ id: 'primary', x: 28, y: 20, currentHp: 1000 });
    const nearby = makeTroop({ id: 'nearby', x: 28.5, y: 20, currentHp: 1000 });
    const defense = makeMortar();
    const ctx = makeCtx({ troops: [primary, nearby], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(primary.currentHp).toBeLessThan(1000);
    expect(nearby.currentHp).toBeLessThan(1000);
  });

  it('skips flying troops when dealing splash damage', () => {
    const ground = makeTroop({ id: 'ground', x: 28, y: 20, currentHp: 1000, isFlying: false });
    const flying = makeTroop({ id: 'flying', x: 28.5, y: 20, currentHp: 1000, isFlying: true });
    const defense = makeMortar();
    const ctx = makeCtx({ troops: [ground, flying], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(ground.currentHp).toBeLessThan(1000);
    expect(flying.currentHp).toBe(1000);
  });

  it('respects attack cooldown', () => {
    const troop = makeTroop({ x: 28, y: 20, currentHp: 1000 });
    const defense = makeMortar({ lastAttackTime: 3, attackSpeed: 5 });
    // elapsed - lastAttackTime = 5 - 3 = 2, which is < 5
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.currentHp).toBe(1000); // no damage, on cooldown
  });

  it('damages troops equal to dps * attackSpeed per shot', () => {
    const troop = makeTroop({ id: 'target', x: 28, y: 20, currentHp: 1000 });
    const defense = makeMortar({ dps: 40, attackSpeed: 5, lastAttackTime: 0 });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    // damage = dps * attackSpeed = 40 * 5 = 200
    expect(troop.currentHp).toBe(800);
  });

  it('does not attack when target is dead', () => {
    const dead = makeTroop({ id: 'dead-target', x: 28, y: 20, currentHp: 0, state: 'dead' });
    const defense = makeMortar({ targetTroopId: 'dead-target' });
    const ctx = makeCtx({ troops: [dead], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    // No error, just returns without acting
    expect(dead.currentHp).toBe(0);
  });

  it('kills troops that reach 0 HP from splash', () => {
    const troop = makeTroop({ id: 'fragile', x: 28, y: 20, currentHp: 50 });
    const defense = makeMortar({ dps: 40, attackSpeed: 5 });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.state).toBe('dead');
    expect(troop.currentHp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Air Sweeper
// ---------------------------------------------------------------------------

describe('Air Sweeper', () => {
  function makeSweeper(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
    return makeDefense({
      name: 'Air Sweeper',
      dps: 0,
      baseDps: 0,
      range: { min: 1, max: 15 },
      attackSpeed: 5,
      lastAttackTime: -5,
      pushbackStrength: 3,
      ...overrides,
    });
  }

  it('pushes flying troops away from the defense', () => {
    // Troop at (25, 20), defense at (20, 20), distance = 5
    const troop = makeTroop({ id: 'flyer', x: 25, y: 20, isFlying: true, currentHp: 500 });
    const defense = makeSweeper();
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    // dx = (25-20)/5 = 1, dy = 0, push = 3 tiles in dx direction
    expect(troop.x).toBe(28);
    expect(troop.y).toBe(20);
  });

  it('ignores ground troops', () => {
    const troop = makeTroop({ id: 'ground', x: 25, y: 20, isFlying: false });
    const defense = makeSweeper();
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.x).toBe(25);
    expect(troop.y).toBe(20);
  });

  it('respects attack cooldown', () => {
    const troop = makeTroop({ id: 'flyer', x: 25, y: 20, isFlying: true });
    const defense = makeSweeper({ lastAttackTime: 2, attackSpeed: 5 });
    // elapsed - lastAttackTime = 5 - 2 = 3, which is < 5
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.x).toBe(25); // not pushed, on cooldown
  });

  it('ignores dead flying troops', () => {
    const troop = makeTroop({ id: 'dead-flyer', x: 25, y: 20, isFlying: true, state: 'dead' });
    const defense = makeSweeper();
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.x).toBe(25);
  });

  it('ignores troops outside max range', () => {
    const troop = makeTroop({ id: 'far-flyer', x: 50, y: 50, isFlying: true });
    const defense = makeSweeper({ range: { min: 1, max: 15 } });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.x).toBe(50);
  });

  it('ignores troops inside min range', () => {
    // Troop at (20.5, 20), defense at (20, 20), distance = 0.5, min = 1
    const troop = makeTroop({ id: 'close-flyer', x: 20.5, y: 20, isFlying: true });
    const defense = makeSweeper({ range: { min: 1, max: 15 } });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.x).toBe(20.5);
  });

  it('pushes multiple flying troops simultaneously', () => {
    const flyer1 = makeTroop({ id: 'f1', x: 25, y: 20, isFlying: true });
    const flyer2 = makeTroop({ id: 'f2', x: 20, y: 25, isFlying: true });
    const defense = makeSweeper();
    const ctx = makeCtx({ troops: [flyer1, flyer2], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(flyer1.x).toBe(28); // pushed 3 tiles in x
    expect(flyer2.y).toBe(28); // pushed 3 tiles in y
  });

  it('uses custom pushbackStrength', () => {
    const troop = makeTroop({ id: 'flyer', x: 25, y: 20, isFlying: true });
    const defense = makeSweeper({ pushbackStrength: 5 });
    const ctx = makeCtx({ troops: [troop], elapsed: 5, deltaMs: 1000 });

    processDefenseSpecial(defense, ctx);

    expect(troop.x).toBe(30); // pushed 5 tiles
  });
});

// ---------------------------------------------------------------------------
// processBombTowerDeath
// ---------------------------------------------------------------------------

describe('processBombTowerDeath', () => {
  function makeBombTower(overrides: Partial<ActiveDefense> = {}): ActiveDefense {
    return makeDefense({
      name: 'Bomb Tower',
      deathDamage: 300,
      deathDamageRadius: 3,
      ...overrides,
    });
  }

  it('deals area damage to troops within the death radius', () => {
    const troop1 = makeTroop({ id: 't1', x: 21, y: 20, currentHp: 500 }); // 1 tile away
    const troop2 = makeTroop({ id: 't2', x: 22, y: 21, currentHp: 500 }); // ~2.2 tiles away
    const defense = makeBombTower();

    processBombTowerDeath(defense, [troop1, troop2]);

    expect(troop1.currentHp).toBe(200); // 500 - 300
    expect(troop2.currentHp).toBe(200);
  });

  it('kills troops that reach 0 HP', () => {
    const troop = makeTroop({ id: 't1', x: 21, y: 20, currentHp: 100 });
    const defense = makeBombTower({ deathDamage: 300 });

    processBombTowerDeath(defense, [troop]);

    expect(troop.state).toBe('dead');
    expect(troop.currentHp).toBe(0);
  });

  it('does nothing if deathDamage is 0', () => {
    const troop = makeTroop({ id: 't1', x: 21, y: 20, currentHp: 500 });
    const defense = makeBombTower({ deathDamage: 0 });

    processBombTowerDeath(defense, [troop]);

    expect(troop.currentHp).toBe(500);
  });

  it('does nothing if deathDamage is undefined (defaults to 0)', () => {
    const troop = makeTroop({ id: 't1', x: 21, y: 20, currentHp: 500 });
    const defense = makeDefense({ name: 'Bomb Tower' }); // no deathDamage set

    processBombTowerDeath(defense, [troop]);

    expect(troop.currentHp).toBe(500);
  });

  it('skips dead troops', () => {
    const deadTroop = makeTroop({ id: 'dead', x: 21, y: 20, currentHp: 0, state: 'dead' });
    const aliveTroop = makeTroop({ id: 'alive', x: 21, y: 20, currentHp: 500 });
    const defense = makeBombTower({ deathDamage: 100 });

    processBombTowerDeath(defense, [deadTroop, aliveTroop]);

    expect(deadTroop.currentHp).toBe(0);
    expect(aliveTroop.currentHp).toBe(400);
  });

  it('does not damage troops outside the radius', () => {
    const nearTroop = makeTroop({ id: 'near', x: 22, y: 20, currentHp: 500 }); // 2 tiles
    const farTroop = makeTroop({ id: 'far', x: 30, y: 30, currentHp: 500 }); // ~14 tiles
    const defense = makeBombTower({ deathDamageRadius: 3 });

    processBombTowerDeath(defense, [nearTroop, farTroop]);

    expect(nearTroop.currentHp).toBe(200);
    expect(farTroop.currentHp).toBe(500);
  });

  it('uses custom deathDamageRadius', () => {
    const troop = makeTroop({ id: 't1', x: 25, y: 20, currentHp: 500 }); // 5 tiles away
    const defense = makeBombTower({ deathDamageRadius: 6 });

    processBombTowerDeath(defense, [troop]);

    expect(troop.currentHp).toBe(200); // within radius 6
  });

  it('handles all troops being dead gracefully', () => {
    const troops = [
      makeTroop({ id: 'd1', currentHp: 0, state: 'dead', x: 21, y: 20 }),
      makeTroop({ id: 'd2', currentHp: 0, state: 'dead', x: 22, y: 20 }),
    ];
    const defense = makeBombTower();

    // Should not throw
    processBombTowerDeath(defense, troops);

    expect(troops[0]!.currentHp).toBe(0);
    expect(troops[1]!.currentHp).toBe(0);
  });

  it('handles empty troop array', () => {
    const defense = makeBombTower();

    // Should not throw
    processBombTowerDeath(defense, []);
  });

  it('does not damage troops with negative deathDamage', () => {
    const troop = makeTroop({ id: 't1', x: 21, y: 20, currentHp: 500 });
    const defense = makeBombTower({ deathDamage: -50 });

    processBombTowerDeath(defense, [troop]);

    expect(troop.currentHp).toBe(500); // deathDmg <= 0 returns early
  });
});
