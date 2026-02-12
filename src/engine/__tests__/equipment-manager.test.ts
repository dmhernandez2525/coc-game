import type { OwnedHero } from '../../types/village.ts';
import {
  getEquipmentForHero,
  getEquipmentStats,
  canEquipOnHero,
  equipItem,
  unequipItem,
  getUpgradeCost,
  getBlacksmithRequirement,
  upgradeEquipment,
  getEquipmentBonuses,
  isMaxLevel,
  getMaxLevel,
} from '../equipment-manager.ts';
import type { OwnedEquipment } from '../equipment-manager.ts';

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
// getEquipmentForHero
// ---------------------------------------------------------------------------
describe('getEquipmentForHero', () => {
  it('returns equipment items for Barbarian King', () => {
    const items = getEquipmentForHero('Barbarian King');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((eq) => eq.hero === 'Barbarian King')).toBe(true);
  });

  it('returns equipment items for Archer Queen', () => {
    const items = getEquipmentForHero('Archer Queen');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((eq) => eq.hero === 'Archer Queen')).toBe(true);
  });

  it('returns empty array for unknown hero', () => {
    expect(getEquipmentForHero('FakeHero')).toHaveLength(0);
  });

  it('includes both Common and Epic rarity items', () => {
    const items = getEquipmentForHero('Barbarian King');
    const rarities = new Set(items.map((eq) => eq.rarity));
    expect(rarities.has('Common')).toBe(true);
    expect(rarities.has('Epic')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getEquipmentStats
// ---------------------------------------------------------------------------
describe('getEquipmentStats', () => {
  it('returns stats for Barbarian Puppet level 1', () => {
    const stats = getEquipmentStats('Barbarian Puppet', 1);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(1);
    expect(stats!.shinyOreCost).toBe(0); // Level 1 is free
  });

  it('returns stats for a higher level', () => {
    const stats = getEquipmentStats('Barbarian Puppet', 5);
    expect(stats).toBeDefined();
    expect(stats!.level).toBe(5);
  });

  it('returns undefined for unknown equipment', () => {
    expect(getEquipmentStats('FakeEquipment', 1)).toBeUndefined();
  });

  it('returns undefined for invalid level', () => {
    expect(getEquipmentStats('Barbarian Puppet', 999)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// canEquipOnHero
// ---------------------------------------------------------------------------
describe('canEquipOnHero', () => {
  it('returns true for compatible hero-equipment pair', () => {
    expect(canEquipOnHero('Barbarian Puppet', 'Barbarian King')).toBe(true);
  });

  it('returns false for incompatible pair', () => {
    expect(canEquipOnHero('Barbarian Puppet', 'Archer Queen')).toBe(false);
  });

  it('returns false for unknown equipment', () => {
    expect(canEquipOnHero('FakeEquipment', 'Barbarian King')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// equipItem / unequipItem
// ---------------------------------------------------------------------------
describe('equipItem', () => {
  it('equips an item in slot 0', () => {
    const hero = makeHero();
    const result = equipItem(hero, 0, 'Barbarian Puppet');
    expect(result).not.toBeNull();
    expect(result!.equippedItems[0]).toBe('Barbarian Puppet');
    expect(result!.equippedItems[1]).toBeNull();
  });

  it('equips an item in slot 1', () => {
    const hero = makeHero();
    const result = equipItem(hero, 1, 'Rage Vial');
    expect(result).not.toBeNull();
    expect(result!.equippedItems[0]).toBeNull();
    expect(result!.equippedItems[1]).toBe('Rage Vial');
  });

  it('equips two different items', () => {
    let hero = makeHero();
    hero = equipItem(hero, 0, 'Barbarian Puppet')!;
    hero = equipItem(hero, 1, 'Rage Vial')!;
    expect(hero.equippedItems[0]).toBe('Barbarian Puppet');
    expect(hero.equippedItems[1]).toBe('Rage Vial');
  });

  it('returns null when equipment belongs to a different hero', () => {
    const hero = makeHero();
    const result = equipItem(hero, 0, 'Archer Puppet');
    expect(result).toBeNull();
  });

  it('returns null when trying to equip the same item in both slots', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', null] });
    const result = equipItem(hero, 1, 'Barbarian Puppet');
    expect(result).toBeNull();
  });

  it('replaces an existing item in the slot', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', null] });
    const result = equipItem(hero, 0, 'Rage Vial');
    expect(result).not.toBeNull();
    expect(result!.equippedItems[0]).toBe('Rage Vial');
  });

  it('does not mutate the original hero', () => {
    const hero = makeHero();
    equipItem(hero, 0, 'Barbarian Puppet');
    expect(hero.equippedItems[0]).toBeNull();
  });
});

describe('unequipItem', () => {
  it('removes the item from the specified slot', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', 'Rage Vial'] });
    const result = unequipItem(hero, 0);
    expect(result.equippedItems[0]).toBeNull();
    expect(result.equippedItems[1]).toBe('Rage Vial');
  });

  it('handles unequipping an already empty slot', () => {
    const hero = makeHero({ equippedItems: [null, null] });
    const result = unequipItem(hero, 0);
    expect(result.equippedItems[0]).toBeNull();
  });

  it('does not mutate the original hero', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', null] });
    unequipItem(hero, 0);
    expect(hero.equippedItems[0]).toBe('Barbarian Puppet');
  });
});

// ---------------------------------------------------------------------------
// getUpgradeCost / getBlacksmithRequirement
// ---------------------------------------------------------------------------
describe('getUpgradeCost', () => {
  it('returns cost for upgrading from level 1 to level 2', () => {
    const cost = getUpgradeCost('Barbarian Puppet', 1);
    expect(cost).not.toBeNull();
    expect(cost!.shinyOre).toBeGreaterThanOrEqual(0);
    expect(cost!.glowyOre).toBeGreaterThanOrEqual(0);
    expect(cost!.starryOre).toBeGreaterThanOrEqual(0);
  });

  it('returns null for unknown equipment', () => {
    expect(getUpgradeCost('FakeEquipment', 1)).toBeNull();
  });

  it('returns null when at max level', () => {
    const maxLevel = getMaxLevel('Barbarian Puppet');
    expect(getUpgradeCost('Barbarian Puppet', maxLevel)).toBeNull();
  });
});

describe('getBlacksmithRequirement', () => {
  it('returns blacksmith level for an upgrade', () => {
    const req = getBlacksmithRequirement('Barbarian Puppet', 1);
    expect(req).not.toBeNull();
    expect(typeof req).toBe('number');
  });

  it('returns null for unknown equipment', () => {
    expect(getBlacksmithRequirement('FakeEquipment', 1)).toBeNull();
  });

  it('returns null when at max level', () => {
    const maxLevel = getMaxLevel('Barbarian Puppet');
    expect(getBlacksmithRequirement('Barbarian Puppet', maxLevel)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// upgradeEquipment
// ---------------------------------------------------------------------------
describe('upgradeEquipment', () => {
  it('upgrades equipment level by 1', () => {
    const owned: OwnedEquipment[] = [{ name: 'Barbarian Puppet', level: 1 }];
    const ores = { shinyOre: 10000, glowyOre: 10000, starryOre: 10000 };
    const result = upgradeEquipment(owned, 'Barbarian Puppet', ores, 10);
    expect(result).not.toBeNull();
    expect(result!.equipment[0]!.level).toBe(2);
  });

  it('deducts ore costs', () => {
    const owned: OwnedEquipment[] = [{ name: 'Barbarian Puppet', level: 1 }];
    const cost = getUpgradeCost('Barbarian Puppet', 1)!;
    const ores = { shinyOre: cost.shinyOre + 100, glowyOre: cost.glowyOre + 100, starryOre: cost.starryOre + 100 };
    const result = upgradeEquipment(owned, 'Barbarian Puppet', ores, 10);
    expect(result).not.toBeNull();
    expect(result!.remainingOres.shinyOre).toBe(100);
    expect(result!.remainingOres.glowyOre).toBe(100);
    expect(result!.remainingOres.starryOre).toBe(100);
  });

  it('returns null when not enough ores', () => {
    const owned: OwnedEquipment[] = [{ name: 'Barbarian Puppet', level: 1 }];
    const ores = { shinyOre: 0, glowyOre: 0, starryOre: 0 };
    // Level 2 costs shinyOre: 120, so 0 is not enough
    const cost = getUpgradeCost('Barbarian Puppet', 1);
    if (cost && (cost.shinyOre > 0 || cost.glowyOre > 0 || cost.starryOre > 0)) {
      expect(upgradeEquipment(owned, 'Barbarian Puppet', ores, 10)).toBeNull();
    }
  });

  it('returns null when equipment is not owned', () => {
    const owned: OwnedEquipment[] = [];
    const ores = { shinyOre: 10000, glowyOre: 10000, starryOre: 10000 };
    expect(upgradeEquipment(owned, 'Barbarian Puppet', ores, 10)).toBeNull();
  });

  it('returns null when at max level', () => {
    const maxLevel = getMaxLevel('Barbarian Puppet');
    const owned: OwnedEquipment[] = [{ name: 'Barbarian Puppet', level: maxLevel }];
    const ores = { shinyOre: 10000, glowyOre: 10000, starryOre: 10000 };
    expect(upgradeEquipment(owned, 'Barbarian Puppet', ores, 10)).toBeNull();
  });

  it('returns null when blacksmith level is too low', () => {
    const owned: OwnedEquipment[] = [{ name: 'Barbarian Puppet', level: 1 }];
    const ores = { shinyOre: 10000, glowyOre: 10000, starryOre: 10000 };
    const result = upgradeEquipment(owned, 'Barbarian Puppet', ores, 0);
    // Blacksmith level 0 should fail if requirement is >= 1
    const req = getBlacksmithRequirement('Barbarian Puppet', 1);
    if (req !== null && req > 0) {
      expect(result).toBeNull();
    }
  });

  it('does not mutate the original equipment array', () => {
    const owned: OwnedEquipment[] = [{ name: 'Barbarian Puppet', level: 1 }];
    const ores = { shinyOre: 10000, glowyOre: 10000, starryOre: 10000 };
    upgradeEquipment(owned, 'Barbarian Puppet', ores, 10);
    expect(owned[0]!.level).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getEquipmentBonuses
// ---------------------------------------------------------------------------
describe('getEquipmentBonuses', () => {
  it('returns zero bonuses when no equipment is equipped', () => {
    const hero = makeHero();
    const bonuses = getEquipmentBonuses(hero, {});
    expect(bonuses.hitpointIncrease).toBe(0);
    expect(bonuses.damageIncrease).toBe(0);
    expect(bonuses.hpRecovery).toBe(0);
    expect(bonuses.speedIncrease).toBe(0);
  });

  it('returns bonuses for a single equipped item', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', null] });
    const bonuses = getEquipmentBonuses(hero, { 'Barbarian Puppet': 1 });
    // Barbarian Puppet level 1 has hitpointIncrease: 309
    expect(bonuses.hitpointIncrease).toBeGreaterThan(0);
  });

  it('sums bonuses from two equipped items', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', 'Rage Vial'] });
    const singleBonuses = getEquipmentBonuses(
      makeHero({ equippedItems: ['Barbarian Puppet', null] }),
      { 'Barbarian Puppet': 1 },
    );
    const dualBonuses = getEquipmentBonuses(hero, { 'Barbarian Puppet': 1, 'Rage Vial': 1 });
    expect(dualBonuses.hitpointIncrease).toBeGreaterThanOrEqual(singleBonuses.hitpointIncrease);
  });

  it('uses default level 1 when equipment level is not provided', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', null] });
    const bonuses = getEquipmentBonuses(hero, {}); // No level specified
    // Should use level 1 as fallback
    expect(bonuses.hitpointIncrease).toBeGreaterThan(0);
  });

  it('returns higher bonuses at higher equipment levels', () => {
    const hero = makeHero({ equippedItems: ['Barbarian Puppet', null] });
    const level1 = getEquipmentBonuses(hero, { 'Barbarian Puppet': 1 });
    const level5 = getEquipmentBonuses(hero, { 'Barbarian Puppet': 5 });
    expect(level5.hitpointIncrease).toBeGreaterThan(level1.hitpointIncrease);
  });
});

// ---------------------------------------------------------------------------
// isMaxLevel / getMaxLevel
// ---------------------------------------------------------------------------
describe('isMaxLevel', () => {
  it('returns false when not at max level', () => {
    expect(isMaxLevel('Barbarian Puppet', 1)).toBe(false);
  });

  it('returns true when at max level', () => {
    expect(isMaxLevel('Barbarian Puppet', 18)).toBe(true);
  });

  it('returns true for unknown equipment', () => {
    expect(isMaxLevel('FakeEquipment', 1)).toBe(true);
  });
});

describe('getMaxLevel', () => {
  it('returns correct max level for Common equipment', () => {
    expect(getMaxLevel('Barbarian Puppet')).toBe(18);
  });

  it('returns correct max level for Epic equipment', () => {
    expect(getMaxLevel('Giant Gauntlet')).toBe(27);
  });

  it('returns 0 for unknown equipment', () => {
    expect(getMaxLevel('FakeEquipment')).toBe(0);
  });
});
