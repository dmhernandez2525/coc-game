import type { DeployedTroop } from '../../types/battle.ts';
import type { OwnedHero } from '../../types/village.ts';
import {
  getHeroStats,
  getAvailableHeroes,
  deployHero,
  activateHeroAbility,
  getRegenerationTime,
  isHeroAvailableForBattle,
} from '../hero-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  return {
    id: 'hero_test_1',
    name: 'Barbarian King',
    level: 5,
    currentHp: 800,
    maxHp: 1595,
    x: 10,
    y: 20,
    targetId: null,
    state: 'idle',
    dps: 110,
    baseDps: 110,
    attackRange: 1,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

function makeOwnedHero(overrides?: Partial<OwnedHero>): OwnedHero {
  return {
    name: 'Barbarian King',
    level: 5,
    currentHp: 1595,
    isRecovering: false,
    recoveryTimeRemaining: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    equippedItems: [null, null],
    assignedPet: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getHeroStats
// ---------------------------------------------------------------------------
describe('getHeroStats', () => {
  it('returns stats for Barbarian King level 1', () => {
    const stats = getHeroStats('Barbarian King', 1);

    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.dps).toBe(102);
    expect(stats!.hitpoints).toBe(1445);
  });

  it('returns stats for Barbarian King level 5 with ability', () => {
    const stats = getHeroStats('Barbarian King', 5);

    expect(stats).toBeDefined();
    expect(stats!.level).toBe(5);
    expect(stats!.dps).toBe(110);
    expect(stats!.hitpoints).toBe(1595);
    expect(stats!.abilityLevel).toBe(1);
  });

  it('returns stats for Archer Queen level 1', () => {
    const stats = getHeroStats('Archer Queen', 1);

    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.dps).toBe(136);
    expect(stats!.hitpoints).toBe(580);
  });

  it('returns undefined for an unknown hero name', () => {
    const stats = getHeroStats('Fake Hero', 1);

    expect(stats).toBeUndefined();
  });

  it('returns undefined for a level that does not exist', () => {
    const stats = getHeroStats('Barbarian King', 999);

    expect(stats).toBeUndefined();
  });

  it('returns undefined for level 0', () => {
    const stats = getHeroStats('Barbarian King', 0);

    expect(stats).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAvailableHeroes
// ---------------------------------------------------------------------------
describe('getAvailableHeroes', () => {
  it('returns no heroes at TH6 (none unlock before TH7)', () => {
    const available = getAvailableHeroes(6);

    expect(available).toHaveLength(0);
  });

  it('returns Barbarian King at TH7', () => {
    const available = getAvailableHeroes(7);
    const names = available.map((h) => h.name);

    expect(names).toContain('Barbarian King');
    expect(names).not.toContain('Archer Queen');
  });

  it('includes Archer Queen at TH9', () => {
    const available = getAvailableHeroes(9);
    const names = available.map((h) => h.name);

    expect(names).toContain('Barbarian King');
    expect(names).toContain('Archer Queen');
  });

  it('includes Grand Warden at TH11', () => {
    const available = getAvailableHeroes(11);
    const names = available.map((h) => h.name);

    expect(names).toContain('Barbarian King');
    expect(names).toContain('Archer Queen');
    expect(names).toContain('Grand Warden');
    expect(names).not.toContain('Royal Champion');
  });

  it('includes Royal Champion at TH13', () => {
    const available = getAvailableHeroes(13);
    const names = available.map((h) => h.name);

    expect(names).toContain('Royal Champion');
  });

  it('returns more heroes at higher TH levels than lower ones', () => {
    const th7 = getAvailableHeroes(7);
    const th16 = getAvailableHeroes(16);

    expect(th16.length).toBeGreaterThan(th7.length);
  });
});

// ---------------------------------------------------------------------------
// deployHero
// ---------------------------------------------------------------------------
describe('deployHero', () => {
  it('creates a valid DeployedTroop for Barbarian King level 1', () => {
    const troop = deployHero('Barbarian King', 1, 5, 10);

    expect(troop).not.toBeNull();
    expect(troop!.name).toBe('Barbarian King');
    expect(troop!.level).toBe(1);
    expect(troop!.currentHp).toBe(1445);
    expect(troop!.maxHp).toBe(1445);
    expect(troop!.dps).toBe(102);
    expect(troop!.state).toBe('idle');
    expect(troop!.targetId).toBeNull();
  });

  it('sets correct x and y coordinates', () => {
    const troop = deployHero('Barbarian King', 1, 42, 99);

    expect(troop).not.toBeNull();
    expect(troop!.x).toBe(42);
    expect(troop!.y).toBe(99);
  });

  it('sets attackRange and movementSpeed from hero data', () => {
    const troop = deployHero('Barbarian King', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.attackRange).toBe(1);
    expect(troop!.movementSpeed).toBe(16);
  });

  it('sets isFlying to false for ground heroes', () => {
    const troop = deployHero('Barbarian King', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.isFlying).toBe(false);
  });

  it('sets isFlying to true for flying heroes', () => {
    const troop = deployHero('Minion Prince', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.isFlying).toBe(true);
  });

  it('returns null for an unknown hero', () => {
    const troop = deployHero('NonExistentHero', 1, 5, 10);

    expect(troop).toBeNull();
  });

  it('returns null for an invalid level', () => {
    const troop = deployHero('Barbarian King', 999, 5, 10);

    expect(troop).toBeNull();
  });

  it('generates a unique id containing the hero name', () => {
    const troop = deployHero('Barbarian King', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.id).toContain('hero_');
    expect(troop!.id).toContain('Barbarian King');
  });
});

// ---------------------------------------------------------------------------
// activateHeroAbility
// ---------------------------------------------------------------------------
describe('activateHeroAbility', () => {
  it('returns null when abilityLevel is null (Barbarian King level 1)', () => {
    const troop = makeTroop({ level: 1, dps: 102, currentHp: 1000, maxHp: 1445 });
    const result = activateHeroAbility(troop, 'Barbarian King', 1);

    expect(result).toBeNull();
  });

  it('returns null for Barbarian King level 4 (last level without ability)', () => {
    const troop = makeTroop({ level: 4, dps: 108, currentHp: 1000, maxHp: 1556 });
    const result = activateHeroAbility(troop, 'Barbarian King', 4);

    expect(result).toBeNull();
  });

  it('returns null for an unknown hero', () => {
    const troop = makeTroop();
    const result = activateHeroAbility(troop, 'FakeHero', 5);

    expect(result).toBeNull();
  });

  it('boosts hp and dps when ability exists (Barbarian King level 5)', () => {
    // Level 5: abilityHPRecovery = 500, abilityDamageIncrease = 56
    const troop = makeTroop({ currentHp: 800, maxHp: 1595, dps: 110 });
    const result = activateHeroAbility(troop, 'Barbarian King', 5);

    expect(result).not.toBeNull();
    expect(result!.hero.currentHp).toBe(1300); // 800 + 500
    expect(result!.hero.dps).toBe(166);        // 110 + 56
    expect(result!.summonedTroops.length).toBeGreaterThan(0); // Summons Barbarians
  });

  it('caps healed hp at maxHp', () => {
    // Level 5: abilityHPRecovery = 500, maxHp = 1595
    // Set currentHp so that adding 500 would exceed maxHp
    const troop = makeTroop({ currentHp: 1400, maxHp: 1595, dps: 110 });
    const result = activateHeroAbility(troop, 'Barbarian King', 5);

    expect(result).not.toBeNull();
    expect(result!.hero.currentHp).toBe(1595); // Capped at maxHp, not 1900
  });

  it('does not mutate the input DeployedTroop', () => {
    const troop = makeTroop({ currentHp: 800, maxHp: 1595, dps: 110 });
    const originalHp = troop.currentHp;
    const originalDps = troop.dps;
    activateHeroAbility(troop, 'Barbarian King', 5);

    expect(troop.currentHp).toBe(originalHp);
    expect(troop.dps).toBe(originalDps);
  });

  it('preserves other troop properties in the returned hero object', () => {
    const troop = makeTroop({
      currentHp: 800,
      maxHp: 1595,
      dps: 110,
      x: 30,
      y: 40,
      state: 'attacking',
      targetId: 'building_1',
    });
    const result = activateHeroAbility(troop, 'Barbarian King', 5);

    expect(result).not.toBeNull();
    expect(result!.hero.x).toBe(30);
    expect(result!.hero.y).toBe(40);
    expect(result!.hero.state).toBe('attacking');
    expect(result!.hero.targetId).toBe('building_1');
    expect(result!.hero.name).toBe('Barbarian King');
  });
});

// ---------------------------------------------------------------------------
// getRegenerationTime
// ---------------------------------------------------------------------------
describe('getRegenerationTime', () => {
  it('returns correct time for Barbarian King level 1 (600s)', () => {
    const time = getRegenerationTime('Barbarian King', 1);

    expect(time).toBe(600);
  });

  it('returns correct time for Barbarian King level 5 (720s)', () => {
    const time = getRegenerationTime('Barbarian King', 5);

    expect(time).toBe(720);
  });

  it('returns 0 for an unknown hero', () => {
    const time = getRegenerationTime('FakeHero', 1);

    expect(time).toBe(0);
  });

  it('returns 0 for an invalid level', () => {
    const time = getRegenerationTime('Barbarian King', 999);

    expect(time).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isHeroAvailableForBattle
// ---------------------------------------------------------------------------
describe('isHeroAvailableForBattle', () => {
  it('returns true when the hero is not recovering', () => {
    const hero = makeOwnedHero({ isRecovering: false });
    const result = isHeroAvailableForBattle(hero);

    expect(result).toBe(true);
  });

  it('returns false when the hero is recovering', () => {
    const hero = makeOwnedHero({ isRecovering: true, recoveryTimeRemaining: 300 });
    const result = isHeroAvailableForBattle(hero);

    expect(result).toBe(false);
  });
});
