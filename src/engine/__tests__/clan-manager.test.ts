import type { ClanState } from '../clan-manager.ts';
import {
  createClan,
  addClanXP,
  getClanPerk,
  getCastleCapacity,
  getCastleHousingUsed,
  addCastleTroop,
  removeCastleTroop,
  getAvailableClanPerks,
  getXPForNextLevel,
  CLAN_BADGES,
} from '../clan-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClan(overrides?: Partial<ClanState>): ClanState {
  return {
    name: 'Test Clan',
    level: 1,
    xp: 0,
    badgeIndex: 0,
    castleTroops: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createClan
// ---------------------------------------------------------------------------
describe('createClan', () => {
  it('creates a clan with the given name', () => {
    const clan = createClan('My Clan');

    expect(clan.name).toBe('My Clan');
  });

  it('defaults to level 1 with 0 xp', () => {
    const clan = createClan('Starter');

    expect(clan.level).toBe(1);
    expect(clan.xp).toBe(0);
  });

  it('defaults badge index to 0 when not provided', () => {
    const clan = createClan('NoBadge');

    expect(clan.badgeIndex).toBe(0);
  });

  it('accepts a custom badge index', () => {
    const clan = createClan('Custom', 5);

    expect(clan.badgeIndex).toBe(5);
  });

  it('starts with an empty castle troops array', () => {
    const clan = createClan('Empty');

    expect(clan.castleTroops).toEqual([]);
  });

  it('clamps badge index by accepting whatever value is passed (no validation)', () => {
    // The function does not clamp; it stores the raw value.
    // Values beyond badge array length are stored as-is.
    const clan = createClan('Over', 99);

    expect(clan.badgeIndex).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// addClanXP
// ---------------------------------------------------------------------------
describe('addClanXP', () => {
  it('adds XP correctly without leveling up', () => {
    const clan = makeClan({ level: 1, xp: 0 });
    const result = addClanXP(clan, 200);

    expect(result.xp).toBe(200);
    expect(result.level).toBe(1);
  });

  it('levels up when threshold is reached', () => {
    // Level 2 requires 500 XP
    const clan = makeClan({ level: 1, xp: 0 });
    const result = addClanXP(clan, 500);

    expect(result.level).toBe(2);
    expect(result.xp).toBe(0);
  });

  it('carries over excess XP after leveling up', () => {
    // Level 2 requires 500 XP; adding 600 leaves 100 leftover
    const clan = makeClan({ level: 1, xp: 0 });
    const result = addClanXP(clan, 600);

    expect(result.level).toBe(2);
    expect(result.xp).toBe(100);
  });

  it('handles multiple level-ups from a large XP amount', () => {
    // Level 2 needs 500, level 3 needs 700 = 1200 total for level 3
    const clan = makeClan({ level: 1, xp: 0 });
    const result = addClanXP(clan, 1200);

    expect(result.level).toBe(3);
    expect(result.xp).toBe(0);
  });

  it('caps at level 10 and sets XP to 0', () => {
    // Give enough XP to blow past all levels
    const clan = makeClan({ level: 1, xp: 0 });
    const result = addClanXP(clan, 100000);

    expect(result.level).toBe(10);
    expect(result.xp).toBe(0);
  });

  it('returns the same state when already at max level', () => {
    const clan = makeClan({ level: 10, xp: 0 });
    const result = addClanXP(clan, 5000);

    expect(result).toBe(clan);
    expect(result.level).toBe(10);
    expect(result.xp).toBe(0);
  });

  it('does not mutate the original clan state', () => {
    const clan = makeClan({ level: 1, xp: 0 });
    const originalXp = clan.xp;
    const originalLevel = clan.level;
    addClanXP(clan, 600);

    expect(clan.xp).toBe(originalXp);
    expect(clan.level).toBe(originalLevel);
  });

  it('accumulates XP from existing XP', () => {
    const clan = makeClan({ level: 1, xp: 400 });
    const result = addClanXP(clan, 200);

    // 400 + 200 = 600, threshold for level 2 is 500, so 600 - 500 = 100 leftover
    expect(result.level).toBe(2);
    expect(result.xp).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getClanPerk
// ---------------------------------------------------------------------------
describe('getClanPerk', () => {
  it('returns troopDonationCapacity at level 1', () => {
    const clan = makeClan({ level: 1 });
    const value = getClanPerk(clan, 'troopDonationCapacity');

    expect(value).toBe(1);
  });

  it('returns troopDonationCapacity at level 5', () => {
    const clan = makeClan({ level: 5 });
    const value = getClanPerk(clan, 'troopDonationCapacity');

    expect(value).toBe(5);
  });

  it('returns troopDonationCapacity at level 10', () => {
    const clan = makeClan({ level: 10 });
    const value = getClanPerk(clan, 'troopDonationCapacity');

    expect(value).toBe(10);
  });

  it('returns donationUpgradeBonus at level 3', () => {
    const clan = makeClan({ level: 3 });
    const value = getClanPerk(clan, 'donationUpgradeBonus');

    expect(value).toBe(1);
  });

  it('returns treasuryStorageBonus at level 10', () => {
    const clan = makeClan({ level: 10 });
    const value = getClanPerk(clan, 'treasuryStorageBonus');

    expect(value).toBe(25);
  });

  it('returns 0 for an unknown perk name', () => {
    const clan = makeClan({ level: 5 });
    const value = getClanPerk(clan, 'nonExistentPerk');

    expect(value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCastleCapacity
// ---------------------------------------------------------------------------
describe('getCastleCapacity', () => {
  it('returns 0 at TH1', () => {
    expect(getCastleCapacity(1)).toBe(0);
  });

  it('returns 0 at TH2', () => {
    expect(getCastleCapacity(2)).toBe(0);
  });

  it('returns 10 at TH3', () => {
    expect(getCastleCapacity(3)).toBe(10);
  });

  it('returns 20 at TH6', () => {
    expect(getCastleCapacity(6)).toBe(20);
  });

  it('returns 35 at TH10', () => {
    expect(getCastleCapacity(10)).toBe(35);
  });

  it('returns 45 at TH16 (the last defined level)', () => {
    expect(getCastleCapacity(16)).toBe(45);
  });

  it('caps at the max value for very high TH levels', () => {
    // Beyond defined array, should return the last entry (45)
    expect(getCastleCapacity(50)).toBe(45);
  });

  it('returns 0 for negative TH levels', () => {
    expect(getCastleCapacity(-1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// addCastleTroop
// ---------------------------------------------------------------------------
describe('addCastleTroop', () => {
  it('adds a troop within capacity', () => {
    const clan = makeClan();
    // TH6 has capacity 20; Barbarian has housingSpace 1
    const result = addCastleTroop(clan, 'Barbarian', 1, 5, 6);

    expect(result.castleTroops).toHaveLength(1);
    expect(result.castleTroops[0]!.name).toBe('Barbarian');
    expect(result.castleTroops[0]!.count).toBe(5);
    expect(result.castleTroops[0]!.level).toBe(1);
  });

  it('rejects when adding would exceed capacity', () => {
    const clan = makeClan();
    // TH3 has capacity 10; Giant has housingSpace 5; 3 Giants = 15 > 10
    const result = addCastleTroop(clan, 'Giant', 1, 3, 3);

    // Should return unchanged state
    expect(result.castleTroops).toEqual([]);
  });

  it('stacks same troop when adding more of the same name', () => {
    const clan = makeClan({
      castleTroops: [{ name: 'Barbarian', level: 1, count: 3 }],
    });
    // TH6 capacity is 20; currently using 3 * 1 = 3; adding 5 more = 8 total
    const result = addCastleTroop(clan, 'Barbarian', 2, 5, 6);

    expect(result.castleTroops).toHaveLength(1);
    expect(result.castleTroops[0]!.count).toBe(8);
    // Level should be updated to the new level
    expect(result.castleTroops[0]!.level).toBe(2);
  });

  it('returns unchanged state when troop name is not found in data', () => {
    const clan = makeClan();
    const result = addCastleTroop(clan, 'NonExistentTroop', 1, 1, 10);

    expect(result).toBe(clan);
  });

  it('does not mutate the original clan state', () => {
    const clan = makeClan();
    const originalTroops = [...clan.castleTroops];
    addCastleTroop(clan, 'Barbarian', 1, 5, 6);

    expect(clan.castleTroops).toEqual(originalTroops);
  });

  it('allows adding up to exact capacity', () => {
    const clan = makeClan();
    // TH3 has capacity 10; 10 Barbarians (1 space each) = exactly 10
    const result = addCastleTroop(clan, 'Barbarian', 1, 10, 3);

    expect(result.castleTroops).toHaveLength(1);
    expect(result.castleTroops[0]!.count).toBe(10);
  });

  it('rejects adding one more troop when already at capacity', () => {
    const clan = makeClan({
      castleTroops: [{ name: 'Barbarian', level: 1, count: 10 }],
    });
    // TH3 capacity 10; already using 10; adding 1 more = 11 > 10
    const result = addCastleTroop(clan, 'Barbarian', 1, 1, 3);

    // Should be unchanged (still 10 Barbarians)
    expect(result.castleTroops[0]!.count).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// removeCastleTroop
// ---------------------------------------------------------------------------
describe('removeCastleTroop', () => {
  it('removes a troop by name', () => {
    const clan = makeClan({
      castleTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });
    const result = removeCastleTroop(clan, 'Barbarian');

    expect(result.castleTroops).toHaveLength(0);
  });

  it('handles removing a troop that does not exist in castle', () => {
    const clan = makeClan({
      castleTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });
    const result = removeCastleTroop(clan, 'Giant');

    // Barbarian should still be there
    expect(result.castleTroops).toHaveLength(1);
    expect(result.castleTroops[0]!.name).toBe('Barbarian');
  });

  it('does not mutate the original state', () => {
    const clan = makeClan({
      castleTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });
    removeCastleTroop(clan, 'Barbarian');

    expect(clan.castleTroops).toHaveLength(1);
  });

  it('returns empty castle troops when removing from empty', () => {
    const clan = makeClan({ castleTroops: [] });
    const result = removeCastleTroop(clan, 'Barbarian');

    expect(result.castleTroops).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getCastleHousingUsed
// ---------------------------------------------------------------------------
describe('getCastleHousingUsed', () => {
  it('returns 0 for empty castle troops', () => {
    const clan = makeClan({ castleTroops: [] });
    const used = getCastleHousingUsed(clan);

    expect(used).toBe(0);
  });

  it('calculates correctly for a single troop type', () => {
    // Barbarian has housingSpace 1; 5 of them = 5
    const clan = makeClan({
      castleTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    });
    const used = getCastleHousingUsed(clan);

    expect(used).toBe(5);
  });

  it('calculates correctly for multiple troop types', () => {
    // Barbarian (1 space) * 3 = 3, Giant (5 space) * 2 = 10, total = 13
    const clan = makeClan({
      castleTroops: [
        { name: 'Barbarian', level: 1, count: 3 },
        { name: 'Giant', level: 1, count: 2 },
      ],
    });
    const used = getCastleHousingUsed(clan);

    expect(used).toBe(13);
  });

  it('ignores troops that are not found in data', () => {
    const clan = makeClan({
      castleTroops: [
        { name: 'Barbarian', level: 1, count: 3 },
        { name: 'FakeTroop', level: 1, count: 10 },
      ],
    });
    const used = getCastleHousingUsed(clan);

    // Only the Barbarian counts (3 * 1 = 3)
    expect(used).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getAvailableClanPerks
// ---------------------------------------------------------------------------
describe('getAvailableClanPerks', () => {
  it('returns perks with non-zero values at level 1', () => {
    const perks = getAvailableClanPerks(1);

    // At level 1: troopDonationCapacity = 1, donationUpgradeBonus = 0, treasuryStorageBonus = 0
    expect(perks).toHaveLength(1);
    expect(perks[0]!.perkName).toBe('troopDonationCapacity');
    expect(perks[0]!.value).toBe(1);
  });

  it('returns more perks at higher levels', () => {
    const perks = getAvailableClanPerks(5);
    const names = perks.map((p) => p.perkName);

    // At level 5: troopDonationCapacity = 5, donationUpgradeBonus = 1, treasuryStorageBonus = 10
    expect(names).toContain('troopDonationCapacity');
    expect(names).toContain('donationUpgradeBonus');
    expect(names).toContain('treasuryStorageBonus');
    expect(perks).toHaveLength(3);
  });

  it('returns empty for level 0 where all perks are 0', () => {
    const perks = getAvailableClanPerks(0);

    expect(perks).toHaveLength(0);
  });

  it('returns correct values at level 10', () => {
    const perks = getAvailableClanPerks(10);
    const perkMap = Object.fromEntries(perks.map((p) => [p.perkName, p.value]));

    expect(perkMap['troopDonationCapacity']).toBe(10);
    expect(perkMap['donationUpgradeBonus']).toBe(3);
    expect(perkMap['treasuryStorageBonus']).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// getXPForNextLevel
// ---------------------------------------------------------------------------
describe('getXPForNextLevel', () => {
  it('returns 500 for level 1 (XP needed to reach level 2)', () => {
    expect(getXPForNextLevel(1)).toBe(500);
  });

  it('returns 3000 for level 9 (XP needed to reach level 10)', () => {
    expect(getXPForNextLevel(9)).toBe(3000);
  });

  it('returns 0 at max level (10)', () => {
    expect(getXPForNextLevel(10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CLAN_BADGES
// ---------------------------------------------------------------------------
describe('CLAN_BADGES', () => {
  it('contains 8 badge names', () => {
    expect(CLAN_BADGES).toHaveLength(8);
  });

  it('includes expected badge names', () => {
    expect(CLAN_BADGES).toContain('Shield');
    expect(CLAN_BADGES).toContain('Dragon');
    expect(CLAN_BADGES).toContain('Phoenix');
  });
});
