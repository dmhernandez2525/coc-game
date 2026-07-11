import type { OwnedHero, PlacedBuilding } from '../../types/village.ts';
import {
  getAvailablePets,
  getPetHouseLevel,
  isPetUnlocked,
  getUnlockedPets,
  getPetStats,
  canAssignPet,
  assignPet,
  unassignPet,
  createPetTroop,
  deployPet,
  getPetUpgradeCost,
  isPetMaxLevel,
  upgradePet,
  upgradeOwnedPet,
  getOwnedPetLevel,
} from '../pet-manager.ts';
import type { OwnedPet } from '../pet-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHero(overrides?: Partial<OwnedHero>): OwnedHero {
  return {
    name: 'Barbarian King',
    level: 10,
    currentHp: 2000,
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
// getAvailablePets
// ---------------------------------------------------------------------------
describe('getAvailablePets', () => {
  it('returns no pets below TH14', () => {
    expect(getAvailablePets(13)).toHaveLength(0);
  });

  it('returns pets at TH14', () => {
    const available = getAvailablePets(14);
    expect(available.length).toBeGreaterThan(0);
    const names = available.map((p) => p.name);
    expect(names).toContain('L.A.S.S.I');
    expect(names).toContain('Electro Owl');
  });

  it('returns more pets at TH15 than TH14', () => {
    const th14 = getAvailablePets(14);
    const th15 = getAvailablePets(15);
    expect(th15.length).toBeGreaterThan(th14.length);
  });

  it('returns all pets at TH17', () => {
    const all = getAvailablePets(17);
    expect(all.length).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// getPetStats
// ---------------------------------------------------------------------------
describe('getPetStats', () => {
  it('returns stats for L.A.S.S.I level 1', () => {
    const stats = getPetStats('L.A.S.S.I', 1);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.hp).toBeGreaterThan(0);
    expect(stats!.dps).toBeGreaterThan(0);
  });

  it('returns undefined for unknown pet', () => {
    expect(getPetStats('FakePet', 1)).toBeUndefined();
  });

  it('returns undefined for invalid level', () => {
    expect(getPetStats('L.A.S.S.I', 999)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// canAssignPet / assignPet / unassignPet
// ---------------------------------------------------------------------------
describe('canAssignPet', () => {
  it('returns true when pet is not assigned to any hero', () => {
    const heroes = [makeHero(), makeHero({ name: 'Archer Queen' })];
    expect(canAssignPet('L.A.S.S.I', heroes, 'Barbarian King')).toBe(true);
  });

  it('returns false when pet is already assigned to a different hero', () => {
    const heroes = [
      makeHero({ assignedPet: 'L.A.S.S.I' }),
      makeHero({ name: 'Archer Queen' }),
    ];
    expect(canAssignPet('L.A.S.S.I', heroes, 'Archer Queen')).toBe(false);
  });

  it('returns true when reassigning the same pet to the same hero', () => {
    const heroes = [makeHero({ assignedPet: 'L.A.S.S.I' })];
    expect(canAssignPet('L.A.S.S.I', heroes, 'Barbarian King')).toBe(true);
  });

  it('returns false for unknown pet', () => {
    expect(canAssignPet('FakePet', [], 'Barbarian King')).toBe(false);
  });
});

describe('assignPet', () => {
  it('assigns a pet to a hero', () => {
    const hero = makeHero();
    const result = assignPet(hero, 'L.A.S.S.I', [hero]);
    expect(result).not.toBeNull();
    expect(result!.assignedPet).toBe('L.A.S.S.I');
  });

  it('returns null when pet is assigned to another hero', () => {
    const bk = makeHero({ assignedPet: 'L.A.S.S.I' });
    const aq = makeHero({ name: 'Archer Queen' });
    const result = assignPet(aq, 'L.A.S.S.I', [bk, aq]);
    expect(result).toBeNull();
  });

  it('does not mutate the original hero', () => {
    const hero = makeHero();
    assignPet(hero, 'L.A.S.S.I', [hero]);
    expect(hero.assignedPet).toBeNull();
  });
});

describe('unassignPet', () => {
  it('removes pet assignment', () => {
    const hero = makeHero({ assignedPet: 'L.A.S.S.I' });
    const result = unassignPet(hero);
    expect(result.assignedPet).toBeNull();
  });

  it('does not mutate the original hero', () => {
    const hero = makeHero({ assignedPet: 'L.A.S.S.I' });
    unassignPet(hero);
    expect(hero.assignedPet).toBe('L.A.S.S.I');
  });
});

// ---------------------------------------------------------------------------
// deployPet
// ---------------------------------------------------------------------------
describe('deployPet', () => {
  it('deploys a pet as a DeployedTroop', () => {
    const hero = makeHero({ assignedPet: 'L.A.S.S.I' });
    const troop = deployPet(hero, 1, 10, 20);
    expect(troop).not.toBeNull();
    expect(troop!.name).toBe('L.A.S.S.I');
    expect(troop!.state).toBe('idle');
    expect(troop!.currentHp).toBe(troop!.maxHp);
  });

  it('returns null when hero has no pet', () => {
    const hero = makeHero();
    expect(deployPet(hero, 1, 10, 20)).toBeNull();
  });

  it('returns null for invalid pet level', () => {
    const hero = makeHero({ assignedPet: 'L.A.S.S.I' });
    expect(deployPet(hero, 999, 10, 20)).toBeNull();
  });

  it('spawns pet near the hero position', () => {
    const hero = makeHero({ assignedPet: 'Electro Owl' });
    const troop = deployPet(hero, 1, 10, 20);
    expect(troop).not.toBeNull();
    expect(Math.abs(troop!.x - 10)).toBeLessThan(2);
    expect(Math.abs(troop!.y - 20)).toBeLessThan(2);
  });

  it('sets isFlying correctly for flying pets', () => {
    const hero = makeHero({ assignedPet: 'Electro Owl' });
    const troop = deployPet(hero, 1, 0, 0);
    expect(troop).not.toBeNull();
    expect(troop!.isFlying).toBe(true);
  });

  it('sets isFlying correctly for ground pets', () => {
    const hero = makeHero({ assignedPet: 'L.A.S.S.I' });
    const troop = deployPet(hero, 1, 0, 0);
    expect(troop).not.toBeNull();
    expect(troop!.isFlying).toBe(false);
  });

  it('sets canJumpWalls for L.A.S.S.I', () => {
    const hero = makeHero({ assignedPet: 'L.A.S.S.I' });
    const troop = deployPet(hero, 1, 0, 0);
    expect(troop).not.toBeNull();
    expect(troop!.canJumpWalls).toBe(true);
  });

  it('sets canJumpWalls for Mighty Yak', () => {
    const hero = makeHero({ assignedPet: 'Mighty Yak' });
    const troop = deployPet(hero, 1, 0, 0);
    expect(troop).not.toBeNull();
    expect(troop!.canJumpWalls).toBe(true);
  });

  it('generates unique pet id containing the pet name', () => {
    const hero = makeHero({ assignedPet: 'L.A.S.S.I' });
    const troop = deployPet(hero, 1, 0, 0);
    expect(troop).not.toBeNull();
    expect(troop!.id).toContain('pet_');
    expect(troop!.id).toContain('L.A.S.S.I');
  });
});

// ---------------------------------------------------------------------------
// getPetUpgradeCost / isPetMaxLevel / upgradePet
// ---------------------------------------------------------------------------
describe('getPetUpgradeCost', () => {
  it('returns cost for upgrading from level 1', () => {
    const cost = getPetUpgradeCost('L.A.S.S.I', 1);
    expect(cost).not.toBeNull();
    expect(cost!.cost).toBeGreaterThan(0);
  });

  it('returns null for unknown pet', () => {
    expect(getPetUpgradeCost('FakePet', 1)).toBeNull();
  });

  it('returns null at max level', () => {
    // Level count is the max level
    const stats = getPetStats('L.A.S.S.I', 1);
    expect(stats).toBeDefined();
    // Use a very high level that should be beyond max
    expect(getPetUpgradeCost('L.A.S.S.I', 100)).toBeNull();
  });
});

describe('isPetMaxLevel', () => {
  it('returns false at level 1', () => {
    expect(isPetMaxLevel('L.A.S.S.I', 1)).toBe(false);
  });

  it('returns true for unknown pet', () => {
    expect(isPetMaxLevel('FakePet', 1)).toBe(true);
  });
});

describe('upgradePet', () => {
  it('upgrades pet level by 1', () => {
    const owned: OwnedPet[] = [{ name: 'L.A.S.S.I', level: 1 }];
    const result = upgradePet(owned, 'L.A.S.S.I', 10000000);
    expect(result).not.toBeNull();
    expect(result!.pets[0]!.level).toBe(2);
    expect(result!.cost).toBeGreaterThan(0);
  });

  it('returns null when not enough resources', () => {
    const owned: OwnedPet[] = [{ name: 'L.A.S.S.I', level: 1 }];
    expect(upgradePet(owned, 'L.A.S.S.I', 0)).toBeNull();
  });

  it('returns null when pet is not owned', () => {
    expect(upgradePet([], 'L.A.S.S.I', 10000000)).toBeNull();
  });

  it('does not mutate the original array', () => {
    const owned: OwnedPet[] = [{ name: 'L.A.S.S.I', level: 1 }];
    upgradePet(owned, 'L.A.S.S.I', 10000000);
    expect(owned[0]!.level).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getPetHouseLevel / isPetUnlocked / getUnlockedPets
// ---------------------------------------------------------------------------

function makePetHouse(level: number): PlacedBuilding {
  return {
    instanceId: 'bld_ph',
    buildingId: 'Pet House',
    buildingType: 'army',
    level,
    gridX: 10,
    gridY: 10,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

describe('getPetHouseLevel', () => {
  it('returns 0 when no Pet House is placed', () => {
    expect(getPetHouseLevel([])).toBe(0);
  });

  it('returns the placed Pet House level', () => {
    expect(getPetHouseLevel([makePetHouse(3)])).toBe(3);
  });
});

describe('isPetUnlocked', () => {
  it('requires both Town Hall and Pet House levels', () => {
    // L.A.S.S.I: TH14, Pet House 1
    expect(isPetUnlocked('L.A.S.S.I', 14, 1)).toBe(true);
    expect(isPetUnlocked('L.A.S.S.I', 13, 1)).toBe(false);
    expect(isPetUnlocked('L.A.S.S.I', 14, 0)).toBe(false);
  });

  it('gates later pets behind higher Pet House levels', () => {
    // Electro Owl requires Pet House 2
    expect(isPetUnlocked('Electro Owl', 14, 1)).toBe(false);
    expect(isPetUnlocked('Electro Owl', 14, 2)).toBe(true);
  });

  it('returns false for unknown pets', () => {
    expect(isPetUnlocked('FakePet', 17, 11)).toBe(false);
  });
});

describe('getUnlockedPets', () => {
  it('returns nothing without a Pet House', () => {
    expect(getUnlockedPets(14, 0)).toHaveLength(0);
  });

  it('grows with the Pet House level', () => {
    expect(getUnlockedPets(14, 1).map((p) => p.name)).toEqual(['L.A.S.S.I']);
    expect(getUnlockedPets(14, 2)).toHaveLength(2);
  });

  it('still respects the Town Hall gate', () => {
    // Frosty needs TH15 even though Pet House 5 would allow it
    const names = getUnlockedPets(14, 11).map((p) => p.name);
    expect(names).not.toContain('Frosty');
  });
});

// ---------------------------------------------------------------------------
// createPetTroop battle traits
// ---------------------------------------------------------------------------
describe('createPetTroop', () => {
  it('marks the unit as a pet', () => {
    const troop = createPetTroop('L.A.S.S.I', 1, 10, 20);
    expect(troop).not.toBeNull();
    expect(troop!.isPet).toBe(true);
  });

  it('returns null for unknown pets and invalid levels', () => {
    expect(createPetTroop('FakePet', 1, 0, 0)).toBeNull();
    expect(createPetTroop('L.A.S.S.I', 999, 0, 0)).toBeNull();
  });

  it('gives L.A.S.S.I its wall spring', () => {
    const troop = createPetTroop('L.A.S.S.I', 1, 0, 0);
    expect(troop!.canJumpWalls).toBe(true);
    expect(troop!.chainTargets).toBeUndefined();
  });

  it('gives Electro Owl its chain zap', () => {
    const troop = createPetTroop('Electro Owl', 1, 0, 0);
    expect(troop!.chainTargets).toBe(2);
    expect(troop!.chainDamageDecay).toBe(0.8);
    expect(troop!.isFlying).toBe(true);
  });

  it('gives Mighty Yak its wall busting traits', () => {
    const troop = createPetTroop('Mighty Yak', 1, 0, 0);
    expect(troop!.canJumpWalls).toBe(true);
    expect(troop!.wallDamageMultiplier).toBe(20);
  });

  it('turns Unicorn into a healer that deals no damage', () => {
    const stats = getPetStats('Unicorn', 1)!;
    const troop = createPetTroop('Unicorn', 1, 0, 0);
    expect(troop!.dps).toBe(0);
    expect(troop!.healPerSecond).toBe(stats.healingPerSecond);
    expect(troop!.healPerSecond).toBeGreaterThan(0);
    expect(troop!.healRadius).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// upgradeOwnedPet / getOwnedPetLevel
// ---------------------------------------------------------------------------
describe('upgradeOwnedPet', () => {
  it('seeds a level 1 entry for never-upgraded pets and upgrades it', () => {
    const result = upgradeOwnedPet([], 'L.A.S.S.I', 10000000);
    expect(result).not.toBeNull();
    expect(result!.pets).toEqual([{ name: 'L.A.S.S.I', level: 2 }]);
  });

  it('upgrades an existing entry like upgradePet', () => {
    const owned: OwnedPet[] = [{ name: 'L.A.S.S.I', level: 2 }];
    const result = upgradeOwnedPet(owned, 'L.A.S.S.I', 10000000);
    expect(result).not.toBeNull();
    expect(result!.pets[0]!.level).toBe(3);
  });

  it('returns null for unknown pets and insufficient resources', () => {
    expect(upgradeOwnedPet([], 'FakePet', 10000000)).toBeNull();
    expect(upgradeOwnedPet([], 'L.A.S.S.I', 0)).toBeNull();
  });
});

describe('getOwnedPetLevel', () => {
  it('returns the tracked level', () => {
    expect(getOwnedPetLevel([{ name: 'L.A.S.S.I', level: 4 }], 'L.A.S.S.I')).toBe(4);
  });

  it('defaults to level 1 for untracked pets', () => {
    expect(getOwnedPetLevel([], 'Electro Owl')).toBe(1);
  });
});
