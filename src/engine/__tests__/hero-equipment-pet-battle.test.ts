import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ActiveDefense, BattleState, BattleBuilding, DeployedTroop } from '../../types/battle.ts';
import { deployHeroToBattle, tickBattle } from '../battle-engine.ts';
import { createPetTroop, getPetStats } from '../pet-manager.ts';
import { processTroopSpecial } from '../troop-mechanics.ts';

// ---------------------------------------------------------------------------
// Determinism: pin randomness and clock so ids and offsets are stable
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuilding(instanceId: string, overrides?: Partial<BattleBuilding>): BattleBuilding {
  return {
    instanceId,
    name: 'Archer Tower',
    currentHp: 500,
    maxHp: 500,
    x: 20,
    y: 20,
    isDestroyed: false,
    weight: 1,
    ...overrides,
  };
}

function makeTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  return {
    id: 'ally_1',
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 300,
    x: 11,
    y: 10,
    targetId: null,
    state: 'idle',
    dps: 10,
    baseDps: 10,
    attackRange: 0.4,
    movementSpeed: 18,
    isFlying: false,
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
    buildings: [makeBuilding('bb_th', { name: 'Town Hall' })],
    spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: [],
    availableSpells: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Equipment boosts applied on hero deploy
// ---------------------------------------------------------------------------

describe('deployHeroToBattle - equipment boost', () => {
  it('applies the equipment boost to the deployed hero stats', () => {
    const boost = { hitpointIncrease: 240, dpsIncrease: 15, dpsMultiplier: 1.2, speedIncrease: 4 };
    const plain = deployHeroToBattle(makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    }), 'Barbarian King', 8, 12)!.deployedTroops[0]!;
    const boosted = deployHeroToBattle(makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false, boost }],
    }), 'Barbarian King', 8, 12)!.deployedTroops[0]!;

    expect(boosted.maxHp).toBe(plain.maxHp + 240);
    expect(boosted.currentHp).toBe(plain.currentHp + 240);
    expect(boosted.dps).toBe(Math.round((plain.dps + 15) * 1.2));
    expect(boosted.movementSpeed).toBe(plain.movementSpeed + 4);
  });

  it('deploys with unmodified stats when no boost is present', () => {
    const state = makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    });
    const hero = deployHeroToBattle(state, 'Barbarian King', 8, 12)!.deployedTroops[0]!;

    expect(hero.currentHp).toBe(1595);
    expect(hero.dps).toBe(110);
  });
});

// ---------------------------------------------------------------------------
// Pets deployed alongside their hero
// ---------------------------------------------------------------------------

describe('deployHeroToBattle - pet deploy', () => {
  it('drops the assigned pet next to the hero', () => {
    const state = makeBattleState({
      availableHeroes: [{
        name: 'Barbarian King', level: 5, deployed: false,
        pet: { name: 'L.A.S.S.I', level: 2 },
      }],
    });
    const next = deployHeroToBattle(state, 'Barbarian King', 8, 12)!;

    expect(next.deployedTroops).toHaveLength(2);
    const pet = next.deployedTroops[1]!;
    expect(pet.name).toBe('L.A.S.S.I');
    expect(pet.isPet).toBe(true);
    expect(pet.level).toBe(2);
    // Math.random is pinned to 0.5, so the spawn offset is exactly zero
    expect(pet.x).toBe(8);
    expect(pet.y).toBe(12);
  });

  it('carries the pet battle traits into the deployed unit', () => {
    const state = makeBattleState({
      availableHeroes: [{
        name: 'Barbarian King', level: 5, deployed: false,
        pet: { name: 'L.A.S.S.I', level: 1 },
      }],
    });
    const pet = deployHeroToBattle(state, 'Barbarian King', 8, 12)!.deployedTroops[1]!;

    expect(pet.canJumpWalls).toBe(true);
  });

  it('deploys only the hero when no pet is assigned', () => {
    const state = makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    });
    const next = deployHeroToBattle(state, 'Barbarian King', 8, 12)!;

    expect(next.deployedTroops).toHaveLength(1);
    expect(next.deployedTroops[0]!.isHero).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Electro Owl: chain zap in battle
// ---------------------------------------------------------------------------

describe('Electro Owl zap', () => {
  it('chains to two extra buildings with 0.8 damage decay', () => {
    const owl: DeployedTroop = {
      ...createPetTroop('Electro Owl', 1, 10, 10)!,
      state: 'attacking',
      targetId: 'A',
    };
    const dps = getPetStats('Electro Owl', 1)!.dps!;
    const buildings = [
      makeBuilding('A', { x: 12, y: 12 }),
      makeBuilding('B', { x: 13, y: 12 }),
      makeBuilding('C', { x: 15, y: 12 }),
      makeBuilding('D', { x: 20, y: 12 }),
    ];

    const handled = processTroopSpecial(owl, [owl], buildings, [], 1000);

    expect(handled).toBe(true);
    expect(buildings[0]!.currentHp).toBe(500 - dps);
    expect(buildings[1]!.currentHp).toBe(500 - dps * 0.8);
    expect(buildings[2]!.currentHp).toBe(500 - dps * 0.8 * 0.8);
    // Fourth building is beyond the owl's two chain bounces
    expect(buildings[3]!.currentHp).toBe(500);
  });

  it('does nothing while the owl is not attacking', () => {
    const owl = createPetTroop('Electro Owl', 1, 10, 10)!;
    const buildings = [makeBuilding('A', { x: 12, y: 12 })];

    processTroopSpecial(owl, [owl], buildings, [], 1000);

    expect(buildings[0]!.currentHp).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Unicorn: heals its own side instead of fighting
// ---------------------------------------------------------------------------

describe('Unicorn healing', () => {
  it.each([false, true])('follows and fully heals its paired %s hero', (isFlying) => {
    const unicorn = createPetTroop('Unicorn', 1, 10, 10)!;
    const healPerSec = getPetStats('Unicorn', 1)!.healingPerSecond!;
    unicorn.ownerHeroName = 'Archer Queen';
    const hero = makeTroop({
      id: 'hero_queen', name: 'Archer Queen', currentHp: 100, maxHp: 1000,
      x: 20, y: 10, isHero: true, isFlying,
    });

    const handled = processTroopSpecial(unicorn, [unicorn, hero], [], [], 250);

    expect(handled).toBe(true);
    expect(unicorn.state).toBe('moving');
    expect(unicorn.x).toBeGreaterThan(10);
    expect(hero.currentHp).toBe(100);

    unicorn.x = hero.x;
    unicorn.y = hero.y;
    processTroopSpecial(unicorn, [unicorn, hero], [], [], 1000);
    expect(unicorn.targetId).toBe(hero.id);
    expect(hero.currentHp).toBe(100 + healPerSec);
  });

  it('never heals an unpaired hero or ordinary ally', () => {
    const unicorn = createPetTroop('Unicorn', 1, 10, 10)!;
    unicorn.ownerHeroName = 'Archer Queen';
    const wrongHero = makeTroop({
      id: 'hero_king', name: 'Barbarian King', currentHp: 100, maxHp: 1000, isHero: true,
    });
    const ally = makeTroop({ id: 'ally', currentHp: 100, maxHp: 300 });

    processTroopSpecial(unicorn, [unicorn, wrongHero, ally], [], [], 1000);

    expect(wrongHero.currentHp).toBe(100);
    expect(ally.currentHp).toBe(100);
    expect(unicorn.targetId).toBeNull();
    expect(unicorn.state).toBe('idle');
  });

  it('deals no attack damage of its own', () => {
    const unicorn = createPetTroop('Unicorn', 1, 10, 10)!;

    expect(unicorn.dps).toBe(0);
    expect(unicorn.baseDps).toBe(0);
  });
});

describe('Mighty Yak wall busting', () => {
  it('stops at walls and consumes its 20x wall damage multiplier', () => {
    const yak = createPetTroop('Mighty Yak', 1, 10, 10)!;
    yak.state = 'attacking';
    yak.targetId = 'wall';
    const state = makeBattleState({
      timeRemaining: 179,
      deployedTroops: [yak],
      buildings: [makeBuilding('wall', {
        name: 'Wall', x: 10, y: 10, currentHp: 2000, maxHp: 2000,
      })],
    });

    const next = tickBattle(state, 1000);

    expect(yak.canJumpWalls).not.toBe(true);
    expect(next.buildings[0]!.currentHp).toBe(800);
  });
});

describe('pet effect expiry', () => {
  it('restores Frostmite-slowed troop and defense rates at the deadline', () => {
    const troop = makeTroop({
      isDefender: true,
      movementSpeed: 10,
      attackRateMultiplier: 0.4,
      frostSlowUntil: 2,
      preFrostMovementSpeed: 20,
      preFrostAttackRateMultiplier: 0.8,
    });
    const defense: ActiveDefense = {
      buildingInstanceId: 'tower',
      name: 'Archer Tower',
      level: 1,
      currentHp: 500,
      maxHp: 500,
      x: 20,
      y: 20,
      targetTroopId: null,
      dps: 10,
      baseDps: 10,
      range: { min: 0, max: 10 },
      attackSpeed: 2,
      preFrostAttackSpeed: 1,
      frostSlowUntil: 2,
      lastAttackTime: 0,
      isDestroyed: false,
    };
    const state = makeBattleState({
      timeRemaining: 179,
      deployedTroops: [troop],
      defenses: [defense],
    });

    const next = tickBattle(state, 1000);

    expect(next.deployedTroops[0]).toMatchObject({
      movementSpeed: 20,
      attackRateMultiplier: 0.8,
      frostSlowUntil: undefined,
      preFrostMovementSpeed: undefined,
      preFrostAttackRateMultiplier: undefined,
    });
    expect(next.defenses[0]).toMatchObject({
      attackSpeed: 1,
      frostSlowUntil: undefined,
      preFrostAttackSpeed: undefined,
    });
  });
});
