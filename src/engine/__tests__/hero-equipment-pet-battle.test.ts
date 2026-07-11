import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BattleState, BattleBuilding, DeployedTroop } from '../../types/battle.ts';
import { deployHeroToBattle } from '../battle-engine.ts';
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
  it('heals a damaged ground ally within range', () => {
    const unicorn = createPetTroop('Unicorn', 1, 10, 10)!;
    const healPerSec = getPetStats('Unicorn', 1)!.healingPerSecond!;
    const ally = makeTroop({ currentHp: 100, maxHp: 300 });

    const handled = processTroopSpecial(unicorn, [unicorn, ally], [], [], 1000);

    expect(handled).toBe(true);
    expect(ally.currentHp).toBe(100 + healPerSec);
  });

  it('heals heroes at half rate and skips flying allies', () => {
    const unicorn = createPetTroop('Unicorn', 1, 10, 10)!;
    const healPerSec = getPetStats('Unicorn', 1)!.healingPerSecond!;
    const hero = makeTroop({ id: 'hero_1', currentHp: 100, maxHp: 1000, isHero: true });
    const flyer = makeTroop({ id: 'flyer_1', currentHp: 100, maxHp: 300, isFlying: true });

    processTroopSpecial(unicorn, [unicorn, hero, flyer], [], [], 1000);

    expect(hero.currentHp).toBe(100 + healPerSec / 2);
    expect(flyer.currentHp).toBe(100);
  });

  it('deals no attack damage of its own', () => {
    const unicorn = createPetTroop('Unicorn', 1, 10, 10)!;

    expect(unicorn.dps).toBe(0);
    expect(unicorn.baseDps).toBe(0);
  });
});
