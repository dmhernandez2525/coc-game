import type { VillageState, PlacedBuilding } from '../../types/village.ts';
import {
  getTrainingCost,
  getMaxHousingSpace,
  getCurrentHousingUsed,
  getAvailableTroops,
  trainTroop,
  removeTroop,
  getLabLevel,
  canResearchTroop,
} from '../army-manager.ts';

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

function makeState(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 5,
    buildings: [
      makeBuilding('Army Camp', 'army', 1),
      makeBuilding('Barracks', 'army', 5),
    ],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 50000, elixir: 50000, darkElixir: 0, gems: 500 },
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
// getTrainingCost
// ---------------------------------------------------------------------------
describe('getTrainingCost', () => {
  it('returns correct cost for Barbarian (housingSpace 1, elixir type)', () => {
    const cost = getTrainingCost('Barbarian');

    expect(cost).toBeDefined();
    expect(cost!.amount).toBe(50); // 1 * 50
    expect(cost!.resource).toBe('Elixir');
    expect(cost!.time).toBe(5); // 1 * 5 seconds
  });

  it('returns correct cost for Giant (housingSpace 5, elixir type)', () => {
    const cost = getTrainingCost('Giant');

    expect(cost).toBeDefined();
    expect(cost!.amount).toBe(250); // 5 * 50
    expect(cost!.resource).toBe('Elixir');
    expect(cost!.time).toBe(25); // 5 * 5 seconds
  });

  it('returns undefined for an unknown troop name', () => {
    const cost = getTrainingCost('NonExistentTroop');

    expect(cost).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getMaxHousingSpace
// ---------------------------------------------------------------------------
describe('getMaxHousingSpace', () => {
  it('returns capacity from a level 1 Army Camp (20)', () => {
    const state = makeState();
    const maxSpace = getMaxHousingSpace(state);

    expect(maxSpace).toBe(20);
  });

  it('returns 0 when there are no Army Camps', () => {
    const state = makeState({
      buildings: [makeBuilding('Barracks', 'army', 5)],
    });
    const maxSpace = getMaxHousingSpace(state);

    expect(maxSpace).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCurrentHousingUsed
// ---------------------------------------------------------------------------
describe('getCurrentHousingUsed', () => {
  it('returns 0 with an empty army', () => {
    const state = makeState();
    const used = getCurrentHousingUsed(state);

    expect(used).toBe(0);
  });

  it('returns correct total with multiple troop types', () => {
    const state = makeState({
      army: [
        { name: 'Barbarian', level: 1, count: 5 }, // 5 * 1 = 5
        { name: 'Giant', level: 1, count: 2 },      // 2 * 5 = 10
      ],
    });
    const used = getCurrentHousingUsed(state);

    expect(used).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// getAvailableTroops
// ---------------------------------------------------------------------------
describe('getAvailableTroops', () => {
  it('returns Barbarian at TH1 with Barracks level 1', () => {
    const state = makeState({
      townHallLevel: 1,
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 1),
      ],
    });
    const available = getAvailableTroops(state);
    const names = available.map((t) => t.name);

    expect(names).toContain('Barbarian');
  });

  it('includes Archer when Barracks is level 2 or above', () => {
    const state = makeState({
      townHallLevel: 1,
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 2),
      ],
    });
    const available = getAvailableTroops(state);
    const names = available.map((t) => t.name);

    expect(names).toContain('Barbarian');
    expect(names).toContain('Archer');
  });

  it('filters out troops that require a higher Town Hall level', () => {
    // TH1 with high Barracks should still not unlock troops needing TH2+
    const state = makeState({
      townHallLevel: 1,
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 10),
      ],
    });
    const available = getAvailableTroops(state);
    const names = available.map((t) => t.name);

    // Goblin requires TH2, so it should be excluded
    expect(names).not.toContain('Goblin');
    // Barbarian, Archer, Giant are all TH1
    expect(names).toContain('Barbarian');
    expect(names).toContain('Archer');
    expect(names).toContain('Giant');
  });
});

// ---------------------------------------------------------------------------
// trainTroop
// ---------------------------------------------------------------------------
describe('trainTroop', () => {
  it('successfully trains a Barbarian and adds it to the army', () => {
    const state = makeState();
    const result = trainTroop(state, 'Barbarian');

    expect(result).not.toBeNull();
    expect(result!.army).toHaveLength(1);
    expect(result!.army[0]!.name).toBe('Barbarian');
    expect(result!.army[0]!.count).toBe(1);
    expect(result!.army[0]!.level).toBe(1);
  });

  it('deducts the elixir cost from resources', () => {
    const state = makeState({
      resources: { gold: 50000, elixir: 1000, darkElixir: 0, gems: 500 },
    });
    const result = trainTroop(state, 'Barbarian');

    expect(result).not.toBeNull();
    // Barbarian costs 50 Elixir (housingSpace 1 * 50)
    expect(result!.resources.elixir).toBe(950);
  });

  it('increments count when training a troop already in the army', () => {
    const state = makeState({
      army: [{ name: 'Barbarian', level: 1, count: 3 }],
    });
    const result = trainTroop(state, 'Barbarian');

    expect(result).not.toBeNull();
    expect(result!.army).toHaveLength(1);
    expect(result!.army[0]!.count).toBe(4);
  });

  it('returns null when the player cannot afford the training cost', () => {
    const state = makeState({
      resources: { gold: 50000, elixir: 10, darkElixir: 0, gems: 500 },
    });
    const result = trainTroop(state, 'Barbarian');

    expect(result).toBeNull();
  });

  it('returns null when there is no housing space available', () => {
    // Level 1 Army Camp holds 20 troops. Fill it with 20 Barbarians (1 space each).
    const state = makeState({
      army: [{ name: 'Barbarian', level: 1, count: 20 }],
    });
    const result = trainTroop(state, 'Barbarian');

    expect(result).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = makeState();
    const originalElixir = state.resources.elixir;
    const originalArmy = [...state.army];
    trainTroop(state, 'Barbarian');

    expect(state.resources.elixir).toBe(originalElixir);
    expect(state.army).toEqual(originalArmy);
  });
});

// ---------------------------------------------------------------------------
// removeTroop
// ---------------------------------------------------------------------------
describe('removeTroop', () => {
  it('reduces the troop count by 1 when count defaults to 1', () => {
    const state = makeState({
      army: [{ name: 'Barbarian', level: 1, count: 5 }],
    });
    const result = removeTroop(state, 'Barbarian');

    expect(result.army).toHaveLength(1);
    expect(result.army[0]!.count).toBe(4);
  });

  it('removes the troop entry entirely when count reaches 0', () => {
    const state = makeState({
      army: [{ name: 'Barbarian', level: 1, count: 1 }],
    });
    const result = removeTroop(state, 'Barbarian');

    expect(result.army).toHaveLength(0);
  });

  it('handles removing from an empty army gracefully', () => {
    const state = makeState({ army: [] });
    const result = removeTroop(state, 'Barbarian');

    expect(result.army).toHaveLength(0);
  });

  it('does not mutate the original state', () => {
    const state = makeState({
      army: [{ name: 'Barbarian', level: 1, count: 3 }],
    });
    removeTroop(state, 'Barbarian');

    expect(state.army[0]!.count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getLabLevel
// ---------------------------------------------------------------------------
describe('getLabLevel', () => {
  it('returns 0 when no Laboratory is present', () => {
    const state = makeState();
    const level = getLabLevel(state);

    expect(level).toBe(0);
  });

  it('returns the correct level when a Laboratory is placed', () => {
    const state = makeState({
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 5),
        makeBuilding('Laboratory', 'army', 4),
      ],
    });
    const level = getLabLevel(state);

    expect(level).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// canResearchTroop
// ---------------------------------------------------------------------------
describe('canResearchTroop', () => {
  it('returns true when lab level and resources are sufficient', () => {
    // Barbarian level 2 requires labLevelRequired: 1, upgradeCost: 20000 Elixir
    const state = makeState({
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 5),
        makeBuilding('Laboratory', 'army', 1),
      ],
      resources: { gold: 50000, elixir: 50000, darkElixir: 0, gems: 500 },
    });
    // currentLevel 1 means next level data is at index 1 (level 2)
    const result = canResearchTroop(state, 'Barbarian', 1);

    expect(result).toBe(true);
  });

  it('returns false when the lab level is too low for the upgrade', () => {
    // Barbarian level 3 requires labLevelRequired: 3, but lab is level 1
    const state = makeState({
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 5),
        makeBuilding('Laboratory', 'army', 1),
      ],
      resources: { gold: 50000, elixir: 100000, darkElixir: 0, gems: 500 },
    });
    // currentLevel 2 means next level data is at index 2 (level 3, needs lab 3)
    const result = canResearchTroop(state, 'Barbarian', 2);

    expect(result).toBe(false);
  });

  it('returns false when the player cannot afford the upgrade cost', () => {
    // Barbarian level 2 requires 20000 Elixir, but we only have 100
    const state = makeState({
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 5),
        makeBuilding('Laboratory', 'army', 1),
      ],
      resources: { gold: 50000, elixir: 100, darkElixir: 0, gems: 500 },
    });
    const result = canResearchTroop(state, 'Barbarian', 1);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAvailableTroops - branch coverage
// ---------------------------------------------------------------------------
describe('getAvailableTroops', () => {
  it('filters out troops above the current TH level', () => {
    const state = makeState({ townHallLevel: 1 });
    const troops = getAvailableTroops(state);
    for (const troop of troops) {
      expect(troop.thUnlock).toBeLessThanOrEqual(1);
    }
  });

  it('includes dark elixir troops when Dark Barracks is present', () => {
    const state = makeState({
      townHallLevel: 7,
      buildings: [
        makeBuilding('Army Camp', 'army', 1),
        makeBuilding('Barracks', 'army', 10),
        makeBuilding('Dark Barracks', 'army', 1),
      ],
    });
    const troops = getAvailableTroops(state);
    const darkTroops = troops.filter((t) => t.type === 'dark_elixir');
    expect(darkTroops.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getMaxHousingSpace - branch coverage
// ---------------------------------------------------------------------------
describe('getMaxHousingSpace', () => {
  it('returns 0 when no Army Camps are present', () => {
    const state = makeState({ buildings: [] });
    expect(getMaxHousingSpace(state)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCurrentHousingUsed - branch coverage
// ---------------------------------------------------------------------------
describe('getCurrentHousingUsed', () => {
  it('returns 0 for an empty army', () => {
    const state = makeState({ army: [] });
    expect(getCurrentHousingUsed(state)).toBe(0);
  });

  it('sums housing for multiple troop types', () => {
    const state = makeState({
      army: [
        { name: 'Barbarian', level: 1, count: 10 },
        { name: 'Giant', level: 1, count: 2 },
      ],
    });
    const used = getCurrentHousingUsed(state);
    // Barbarian = 1 space * 10, Giant = 5 space * 2 = 20
    expect(used).toBe(20);
  });

  it('skips unknown troops gracefully', () => {
    const state = makeState({
      army: [
        { name: 'FakeTroop', level: 1, count: 5 },
        { name: 'Barbarian', level: 1, count: 3 },
      ],
    });
    const used = getCurrentHousingUsed(state);
    // Only Barbarian counts (3 * 1 = 3)
    expect(used).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// trainTroop - branch coverage
// ---------------------------------------------------------------------------
describe('trainTroop additional branches', () => {
  it('returns null for a nonexistent troop name', () => {
    const state = makeState();
    expect(trainTroop(state, 'NonexistentTroop')).toBeNull();
  });

  it('returns null when housing space is full', () => {
    // Army Camp level 1 has limited capacity; fill it up
    const state = makeState({
      buildings: [makeBuilding('Army Camp', 'army', 1), makeBuilding('Barracks', 'army', 5)],
      army: [{ name: 'Giant', level: 1, count: 100 }],
    });
    expect(trainTroop(state, 'Barbarian')).toBeNull();
  });

  it('increments count when training an already-owned troop', () => {
    const state = makeState({
      army: [{ name: 'Barbarian', level: 1, count: 3 }],
    });
    const result = trainTroop(state, 'Barbarian');
    expect(result).not.toBeNull();
    expect(result!.army[0]!.count).toBe(4);
  });

  it('adds a new entry when training a troop not yet in the army', () => {
    const state = makeState({ army: [] });
    const result = trainTroop(state, 'Barbarian');
    expect(result).not.toBeNull();
    expect(result!.army).toHaveLength(1);
    expect(result!.army[0]!.name).toBe('Barbarian');
    expect(result!.army[0]!.count).toBe(1);
  });

  it('returns null when insufficient resources', () => {
    const state = makeState({
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
    });
    expect(trainTroop(state, 'Barbarian')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// canResearchTroop - branch coverage
// ---------------------------------------------------------------------------
describe('canResearchTroop additional branches', () => {
  it('returns false for a nonexistent troop name', () => {
    const state = makeState({
      buildings: [makeBuilding('Laboratory', 'army', 5)],
    });
    expect(canResearchTroop(state, 'FakeTroop', 1)).toBe(false);
  });

  it('returns false when current level exceeds available levels', () => {
    const state = makeState({
      buildings: [makeBuilding('Laboratory', 'army', 12)],
      resources: { gold: 999999, elixir: 999999, darkElixir: 999999, gems: 999 },
    });
    expect(canResearchTroop(state, 'Barbarian', 999)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hardening: removeTroop cannot produce negative counts
// ---------------------------------------------------------------------------
describe('removeTroop hardening', () => {
  it('clamps troop count to 0 when removing more than available', () => {
    const state = makeState({
      army: [{ name: 'Barbarian', level: 1, count: 2 }],
    });
    const result = removeTroop(state, 'Barbarian', 100);

    // Count should be clamped to 0 and filtered out
    expect(result.army).toHaveLength(0);
  });

  it('leaves other troops untouched when removing one type', () => {
    const state = makeState({
      army: [
        { name: 'Barbarian', level: 1, count: 5 },
        { name: 'Archer', level: 1, count: 3 },
      ],
    });
    const result = removeTroop(state, 'Barbarian', 999);

    expect(result.army).toHaveLength(1);
    expect(result.army[0]!.name).toBe('Archer');
    expect(result.army[0]!.count).toBe(3);
  });
});
