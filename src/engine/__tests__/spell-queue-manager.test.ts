import type { VillageState, PlacedBuilding } from '../../types/village.ts';
import {
  getSpellFactoryLevel,
  getDarkSpellFactoryLevel,
  getMaxSpellCapacity,
  getCurrentSpellHousing,
  getSpellTrainingCost,
  canTrainSpell,
  getAvailableSpells,
  trainSpell,
  removeSpell,
} from '../spell-queue-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuilding(
  id: string,
  type: PlacedBuilding['buildingType'],
  level: number,
): PlacedBuilding {
  return {
    instanceId: `test_${id}`,
    buildingId: id,
    buildingType: type,
    level,
    gridX: 10,
    gridY: 10,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

function makeVillage(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 8,
    buildings: [
      makeBuilding('Spell Factory', 'army', 3),
      makeBuilding('Dark Spell Factory', 'army', 2),
    ],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 500000, elixir: 500000, darkElixir: 50000, gems: 1000 },
    builders: [{ id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 }],
    army: [],
    spells: [],
    heroes: [],
    trophies: 0,
    league: 'Unranked',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: Date.now(),
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getSpellFactoryLevel
// ---------------------------------------------------------------------------

describe('getSpellFactoryLevel', () => {
  it('returns 0 when there is no Spell Factory', () => {
    const state = makeVillage({ buildings: [] });
    const level = getSpellFactoryLevel(state);

    expect(level).toBe(0);
  });

  it('returns the correct level when a Spell Factory exists', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Spell Factory', 'army', 4)],
    });
    const level = getSpellFactoryLevel(state);

    expect(level).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// getDarkSpellFactoryLevel
// ---------------------------------------------------------------------------

describe('getDarkSpellFactoryLevel', () => {
  it('returns 0 when there is no Dark Spell Factory', () => {
    const state = makeVillage({ buildings: [] });
    const level = getDarkSpellFactoryLevel(state);

    expect(level).toBe(0);
  });

  it('returns the correct level when a Dark Spell Factory exists', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Dark Spell Factory', 'army', 3)],
    });
    const level = getDarkSpellFactoryLevel(state);

    expect(level).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getMaxSpellCapacity
// ---------------------------------------------------------------------------

describe('getMaxSpellCapacity', () => {
  it('returns 0 when there is no Spell Factory', () => {
    const state = makeVillage({ buildings: [] });
    const capacity = getMaxSpellCapacity(state);

    expect(capacity).toBe(0);
  });

  it('returns base capacity from Spell Factory level (sfLevel + 1)', () => {
    // Spell Factory level 3 => capacity 4, no dark factory
    const state = makeVillage({
      buildings: [makeBuilding('Spell Factory', 'army', 3)],
    });
    const capacity = getMaxSpellCapacity(state);

    expect(capacity).toBe(4); // 3 + 1
  });

  it('adds dark factory capacity when Dark Spell Factory exists', () => {
    // SF level 3 => 4, DSF level 2 => +2 = 6
    const state = makeVillage();
    const capacity = getMaxSpellCapacity(state);

    expect(capacity).toBe(6); // (3 + 1) + 2
  });

  it('scales with higher Spell Factory levels', () => {
    // SF level 6 => 7, DSF level 4 => +4 = 11
    const state = makeVillage({
      buildings: [
        makeBuilding('Spell Factory', 'army', 6),
        makeBuilding('Dark Spell Factory', 'army', 4),
      ],
    });
    const capacity = getMaxSpellCapacity(state);

    expect(capacity).toBe(11); // (6 + 1) + 4
  });

  it('handles only Dark Spell Factory with no regular Spell Factory', () => {
    // No SF => 0, DSF level 2 => +2 = 2
    const state = makeVillage({
      buildings: [makeBuilding('Dark Spell Factory', 'army', 2)],
    });
    const capacity = getMaxSpellCapacity(state);

    expect(capacity).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getCurrentSpellHousing
// ---------------------------------------------------------------------------

describe('getCurrentSpellHousing', () => {
  it('returns 0 when there are no spells', () => {
    const state = makeVillage();
    const housing = getCurrentSpellHousing(state);

    expect(housing).toBe(0);
  });

  it('calculates housing for a single spell type', () => {
    // Lightning Spell has housingSpace 1
    const state = makeVillage({
      spells: [{ name: 'Lightning Spell', level: 1, count: 3 }],
    });
    const housing = getCurrentSpellHousing(state);

    expect(housing).toBe(3); // 3 * 1
  });

  it('calculates housing for multiple spell types', () => {
    // Lightning Spell: housingSpace 1, Poison Spell: housingSpace 1
    const state = makeVillage({
      spells: [
        { name: 'Lightning Spell', level: 1, count: 2 },
        { name: 'Poison Spell', level: 1, count: 1 },
      ],
    });
    const housing = getCurrentSpellHousing(state);

    expect(housing).toBe(3); // (2 * 1) + (1 * 1)
  });

  it('ignores unknown spells in the list', () => {
    const state = makeVillage({
      spells: [
        { name: 'Lightning Spell', level: 1, count: 2 },
        { name: 'Nonexistent Spell', level: 1, count: 5 },
      ],
    });
    const housing = getCurrentSpellHousing(state);

    expect(housing).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getSpellTrainingCost
// ---------------------------------------------------------------------------

describe('getSpellTrainingCost', () => {
  it('returns correct cost for an elixir spell', () => {
    // Lightning Spell: housingSpace 1, type elixir => 1 * 2000 = 2000 Elixir
    const cost = getSpellTrainingCost('Lightning Spell');

    expect(cost).toBeDefined();
    expect(cost!.amount).toBe(2000);
    expect(cost!.resource).toBe('Elixir');
    expect(cost!.time).toBe(60); // 1 * 60
  });

  it('returns correct cost for a dark elixir spell', () => {
    // Poison Spell: housingSpace 1, type dark_elixir => 1 * 150 = 150 Dark Elixir
    const cost = getSpellTrainingCost('Poison Spell');

    expect(cost).toBeDefined();
    expect(cost!.amount).toBe(150);
    expect(cost!.resource).toBe('Dark Elixir');
    expect(cost!.time).toBe(60); // 1 * 60
  });

  it('returns undefined for an unknown spell name', () => {
    const cost = getSpellTrainingCost('Nonexistent Spell');

    expect(cost).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// canTrainSpell
// ---------------------------------------------------------------------------

describe('canTrainSpell', () => {
  it('returns false when there is no Spell Factory for an elixir spell', () => {
    const state = makeVillage({ buildings: [] });

    expect(canTrainSpell(state, 'Lightning Spell')).toBe(false);
  });

  it('returns false when there is no Dark Spell Factory for a dark spell', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Spell Factory', 'army', 3)],
    });

    expect(canTrainSpell(state, 'Poison Spell')).toBe(false);
  });

  it('returns false when spell capacity is full', () => {
    // SF level 1 => capacity 2, no DSF => total capacity 2
    // Fill with 2 lightning spells (housingSpace 1 each)
    const state = makeVillage({
      buildings: [makeBuilding('Spell Factory', 'army', 1)],
      spells: [{ name: 'Lightning Spell', level: 1, count: 2 }],
    });

    expect(canTrainSpell(state, 'Lightning Spell')).toBe(false);
  });

  it('returns false when the player lacks resources', () => {
    // Lightning Spell costs 2000 Elixir
    const state = makeVillage({
      resources: { gold: 500000, elixir: 100, darkElixir: 50000, gems: 1000 },
    });

    expect(canTrainSpell(state, 'Lightning Spell')).toBe(false);
  });

  it('returns false for an unknown spell name', () => {
    const state = makeVillage();

    expect(canTrainSpell(state, 'Fake Spell')).toBe(false);
  });

  it('returns true when factory exists, capacity available, and resources sufficient', () => {
    const state = makeVillage();

    expect(canTrainSpell(state, 'Lightning Spell')).toBe(true);
  });

  it('returns true for a dark spell when Dark Spell Factory exists and resources are sufficient', () => {
    const state = makeVillage();

    expect(canTrainSpell(state, 'Poison Spell')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAvailableSpells
// ---------------------------------------------------------------------------

describe('getAvailableSpells', () => {
  it('filters out spells that require a higher TH level', () => {
    // Poison Spell requires TH8. At TH7, it should be excluded.
    const state = makeVillage({
      townHallLevel: 7,
      buildings: [
        makeBuilding('Spell Factory', 'army', 3),
        makeBuilding('Dark Spell Factory', 'army', 1),
      ],
    });
    const available = getAvailableSpells(state);
    const names = available.map((s) => s.name);

    expect(names).not.toContain('Poison Spell');
  });

  it('includes elixir spells when Spell Factory exists and TH is high enough', () => {
    // Lightning Spell requires TH5, Spell Factory level 1
    const state = makeVillage({
      townHallLevel: 5,
      buildings: [makeBuilding('Spell Factory', 'army', 1)],
    });
    const available = getAvailableSpells(state);
    const names = available.map((s) => s.name);

    expect(names).toContain('Lightning Spell');
  });

  it('excludes elixir spells when no Spell Factory exists', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Dark Spell Factory', 'army', 2)],
    });
    const available = getAvailableSpells(state);
    const elixirSpells = available.filter((s) => s.type === 'elixir');

    expect(elixirSpells).toHaveLength(0);
  });

  it('excludes dark spells when no Dark Spell Factory exists', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Spell Factory', 'army', 3)],
    });
    const available = getAvailableSpells(state);
    const darkSpells = available.filter((s) => s.type === 'dark_elixir');

    expect(darkSpells).toHaveLength(0);
  });

  it('includes both elixir and dark spells when both factories exist', () => {
    const state = makeVillage({
      townHallLevel: 9,
      buildings: [
        makeBuilding('Spell Factory', 'army', 4),
        makeBuilding('Dark Spell Factory', 'army', 2),
      ],
    });
    const available = getAvailableSpells(state);
    const types = new Set(available.map((s) => s.type));

    expect(types.has('elixir')).toBe(true);
    expect(types.has('dark_elixir')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// trainSpell
// ---------------------------------------------------------------------------

describe('trainSpell', () => {
  it('adds a new spell to the spells list', () => {
    const state = makeVillage();
    const result = trainSpell(state, 'Lightning Spell');

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.name).toBe('Lightning Spell');
    expect(result!.spells[0]!.count).toBe(1);
    expect(result!.spells[0]!.level).toBe(1);
  });

  it('deducts elixir cost from resources', () => {
    // Lightning Spell costs 2000 Elixir
    const state = makeVillage({
      resources: { gold: 500000, elixir: 10000, darkElixir: 50000, gems: 1000 },
    });
    const result = trainSpell(state, 'Lightning Spell');

    expect(result).not.toBeNull();
    expect(result!.resources.elixir).toBe(8000); // 10000 - 2000
  });

  it('deducts dark elixir cost for dark spells', () => {
    // Poison Spell costs 150 Dark Elixir
    const state = makeVillage({
      resources: { gold: 500000, elixir: 500000, darkElixir: 1000, gems: 1000 },
    });
    const result = trainSpell(state, 'Poison Spell');

    expect(result).not.toBeNull();
    expect(result!.resources.darkElixir).toBe(850); // 1000 - 150
  });

  it('increments count when training a spell already in the list', () => {
    const state = makeVillage({
      spells: [{ name: 'Lightning Spell', level: 1, count: 2 }],
    });
    const result = trainSpell(state, 'Lightning Spell');

    expect(result).not.toBeNull();
    expect(result!.spells).toHaveLength(1);
    expect(result!.spells[0]!.count).toBe(3);
  });

  it('returns null when the player cannot afford the cost', () => {
    const state = makeVillage({
      resources: { gold: 500000, elixir: 100, darkElixir: 50000, gems: 1000 },
    });
    const result = trainSpell(state, 'Lightning Spell');

    expect(result).toBeNull();
  });

  it('returns null when capacity is full', () => {
    // SF level 1 => capacity 2, no DSF
    const state = makeVillage({
      buildings: [makeBuilding('Spell Factory', 'army', 1)],
      spells: [{ name: 'Lightning Spell', level: 1, count: 2 }],
    });
    const result = trainSpell(state, 'Lightning Spell');

    expect(result).toBeNull();
  });

  it('returns null for an unknown spell name', () => {
    const state = makeVillage();
    const result = trainSpell(state, 'Nonexistent Spell');

    expect(result).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = makeVillage();
    const originalElixir = state.resources.elixir;
    const originalSpells = [...state.spells];
    trainSpell(state, 'Lightning Spell');

    expect(state.resources.elixir).toBe(originalElixir);
    expect(state.spells).toEqual(originalSpells);
  });
});

// ---------------------------------------------------------------------------
// removeSpell
// ---------------------------------------------------------------------------

describe('removeSpell', () => {
  it('reduces the spell count by 1 when count defaults to 1', () => {
    const state = makeVillage({
      spells: [{ name: 'Lightning Spell', level: 1, count: 3 }],
    });
    const result = removeSpell(state, 'Lightning Spell');

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]!.count).toBe(2);
  });

  it('removes the spell entry entirely when count reaches 0', () => {
    const state = makeVillage({
      spells: [{ name: 'Lightning Spell', level: 1, count: 1 }],
    });
    const result = removeSpell(state, 'Lightning Spell');

    expect(result.spells).toHaveLength(0);
  });

  it('removes multiple at once when a count is provided', () => {
    const state = makeVillage({
      spells: [{ name: 'Lightning Spell', level: 1, count: 5 }],
    });
    const result = removeSpell(state, 'Lightning Spell', 3);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]!.count).toBe(2);
  });

  it('removes the entry when removing exactly the remaining count', () => {
    const state = makeVillage({
      spells: [{ name: 'Lightning Spell', level: 1, count: 2 }],
    });
    const result = removeSpell(state, 'Lightning Spell', 2);

    expect(result.spells).toHaveLength(0);
  });

  it('handles removing from an empty spells list gracefully', () => {
    const state = makeVillage({ spells: [] });
    const result = removeSpell(state, 'Lightning Spell');

    expect(result.spells).toHaveLength(0);
  });

  it('does not affect other spells in the list', () => {
    const state = makeVillage({
      spells: [
        { name: 'Lightning Spell', level: 1, count: 2 },
        { name: 'Poison Spell', level: 1, count: 1 },
      ],
    });
    const result = removeSpell(state, 'Lightning Spell');

    expect(result.spells).toHaveLength(2);
    expect(result.spells[0]!.name).toBe('Lightning Spell');
    expect(result.spells[0]!.count).toBe(1);
    expect(result.spells[1]!.name).toBe('Poison Spell');
    expect(result.spells[1]!.count).toBe(1);
  });

  it('does not mutate the original state', () => {
    const state = makeVillage({
      spells: [{ name: 'Lightning Spell', level: 1, count: 3 }],
    });
    removeSpell(state, 'Lightning Spell');

    expect(state.spells[0]!.count).toBe(3);
  });
});
