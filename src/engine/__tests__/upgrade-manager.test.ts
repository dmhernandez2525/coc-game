import type { VillageState, PlacedBuilding, BuilderSlot } from '../../types/village.ts';
import {
  getMaxTownHallLevel,
  getNextTownHallData,
  isTownHallMaxLevel,
  getTownHallUpgradeCost,
  getUnlockedBuildings,
  getUnlockedTroops,
  getUnlockedSpells,
  getUnlockedHeroes,
  getAllAvailableTroops,
  getAllAvailableSpells,
  getAllAvailableHeroes,
  getMaxWalls,
  getArmyCampCapacity,
  getTHWeapon,
  canStartTownHallUpgrade,
  startTownHallUpgrade,
  completeTownHallUpgrade,
  getNextTHUnlockSummary,
} from '../upgrade-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTownHallBuilding(overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: 'bld_1',
    buildingId: 'Town Hall',
    buildingType: 'other',
    level: 1,
    gridX: 20,
    gridY: 20,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeBuilder(id: number, overrides?: Partial<BuilderSlot>): BuilderSlot {
  return {
    id,
    isUnlocked: true,
    assignedTo: null,
    timeRemaining: 0,
    ...overrides,
  };
}

function makeVillage(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 1,
    buildings: [makeTownHallBuilding()],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 10000000, elixir: 10000000, darkElixir: 1000000, gems: 5000 },
    builders: [makeBuilder(1), makeBuilder(2)],
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
// TH info
// ---------------------------------------------------------------------------
describe('getMaxTownHallLevel', () => {
  it('returns a number greater than 10', () => {
    expect(getMaxTownHallLevel()).toBeGreaterThan(10);
  });
});

describe('getNextTownHallData', () => {
  it('returns TH2 data when current level is 1', () => {
    const data = getNextTownHallData(1);
    expect(data).toBeDefined();
    expect(data!.level).toBe(2);
  });

  it('returns undefined for max level', () => {
    const max = getMaxTownHallLevel();
    expect(getNextTownHallData(max)).toBeUndefined();
  });
});

describe('isTownHallMaxLevel', () => {
  it('returns false for level 1', () => {
    expect(isTownHallMaxLevel(1)).toBe(false);
  });

  it('returns true for the max level', () => {
    const max = getMaxTownHallLevel();
    expect(isTownHallMaxLevel(max)).toBe(true);
  });
});

describe('getTownHallUpgradeCost', () => {
  it('returns cost for upgrading from TH1', () => {
    const cost = getTownHallUpgradeCost(1);
    expect(cost).not.toBeNull();
    expect(cost!.cost).toBeGreaterThan(0);
    expect(cost!.resource).toBe('Gold');
    expect(cost!.time).toBeGreaterThan(0);
  });

  it('returns null for max level', () => {
    const max = getMaxTownHallLevel();
    expect(getTownHallUpgradeCost(max)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Content gating
// ---------------------------------------------------------------------------
describe('getUnlockedBuildings', () => {
  it('returns buildings for TH1', () => {
    const buildings = getUnlockedBuildings(1);
    expect(buildings).not.toBeNull();
    expect(buildings!.defensive).toContain('Cannon');
  });

  it('returns null for invalid TH level', () => {
    expect(getUnlockedBuildings(999)).toBeNull();
  });
});

describe('getUnlockedTroops', () => {
  it('returns Barbarian at TH1', () => {
    expect(getUnlockedTroops(1)).toContain('Barbarian');
  });

  it('returns Archer at TH2', () => {
    expect(getUnlockedTroops(2)).toContain('Archer');
  });

  it('returns empty array for invalid level', () => {
    expect(getUnlockedTroops(999)).toHaveLength(0);
  });
});

describe('getUnlockedSpells', () => {
  it('returns empty array for TH1', () => {
    expect(getUnlockedSpells(1)).toHaveLength(0);
  });

  it('returns spells at higher TH levels', () => {
    // TH5 unlocks Lightning Spell
    const spells = getUnlockedSpells(5);
    expect(spells.length).toBeGreaterThan(0);
  });
});

describe('getUnlockedHeroes', () => {
  it('returns empty array for TH1', () => {
    expect(getUnlockedHeroes(1)).toHaveLength(0);
  });

  it('returns Barbarian King at TH7', () => {
    expect(getUnlockedHeroes(7)).toContain('Barbarian King');
  });
});

describe('getAllAvailableTroops', () => {
  it('returns cumulative troops up to TH level', () => {
    const th1 = getAllAvailableTroops(1);
    const th3 = getAllAvailableTroops(3);
    expect(th3.length).toBeGreaterThanOrEqual(th1.length);
  });

  it('includes troops from all lower TH levels', () => {
    const troops = getAllAvailableTroops(5);
    expect(troops).toContain('Barbarian'); // TH1
    expect(troops).toContain('Archer'); // TH2
  });
});

describe('getAllAvailableSpells', () => {
  it('accumulates spells through TH levels', () => {
    const spells = getAllAvailableSpells(8);
    expect(spells.length).toBeGreaterThan(0);
  });
});

describe('getAllAvailableHeroes', () => {
  it('includes heroes from lower TH levels', () => {
    const heroes = getAllAvailableHeroes(9);
    expect(heroes).toContain('Barbarian King'); // TH7
    expect(heroes).toContain('Archer Queen'); // TH9
  });
});

describe('getMaxWalls', () => {
  it('returns 0 for TH1', () => {
    expect(getMaxWalls(1)).toBe(0);
  });

  it('returns 25 for TH2', () => {
    expect(getMaxWalls(2)).toBe(25);
  });

  it('increases with TH level', () => {
    expect(getMaxWalls(5)).toBeGreaterThan(getMaxWalls(2));
  });
});

describe('getArmyCampCapacity', () => {
  it('returns 20 for TH1', () => {
    expect(getArmyCampCapacity(1)).toBe(20);
  });

  it('increases with TH level', () => {
    expect(getArmyCampCapacity(5)).toBeGreaterThan(getArmyCampCapacity(1));
  });
});

describe('getTHWeapon', () => {
  it('returns null for TH1', () => {
    expect(getTHWeapon(1)).toBeNull();
  });

  it('returns a weapon for TH12 (Giga Tesla)', () => {
    const weapon = getTHWeapon(12);
    expect(weapon).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TH upgrade actions
// ---------------------------------------------------------------------------
describe('canStartTownHallUpgrade', () => {
  it('returns true when requirements are met', () => {
    const state = makeVillage();
    expect(canStartTownHallUpgrade(state)).toBe(true);
  });

  it('returns false when TH is already upgrading', () => {
    const state = makeVillage({
      buildings: [makeTownHallBuilding({ isUpgrading: true, assignedBuilder: 1 })],
      builders: [makeBuilder(1, { assignedTo: 'bld_1', timeRemaining: 100 }), makeBuilder(2)],
    });
    expect(canStartTownHallUpgrade(state)).toBe(false);
  });

  it('returns false when no builder is available', () => {
    const state = makeVillage({
      builders: [
        makeBuilder(1, { assignedTo: 'other', timeRemaining: 100 }),
        makeBuilder(2, { assignedTo: 'other', timeRemaining: 100 }),
      ],
    });
    expect(canStartTownHallUpgrade(state)).toBe(false);
  });

  it('returns false when not enough resources', () => {
    const state = makeVillage({
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
    });
    expect(canStartTownHallUpgrade(state)).toBe(false);
  });

  it('returns false when TH building is missing', () => {
    const state = makeVillage({ buildings: [] });
    expect(canStartTownHallUpgrade(state)).toBe(false);
  });
});

describe('startTownHallUpgrade', () => {
  it('starts TH upgrade, deducts resources, assigns builder', () => {
    const state = makeVillage();
    const result = startTownHallUpgrade(state);

    expect(result).not.toBeNull();
    const thBuilding = result!.buildings.find((b) => b.buildingId === 'Town Hall');
    expect(thBuilding!.isUpgrading).toBe(true);
    expect(thBuilding!.upgradeTimeRemaining).toBeGreaterThan(0);
    expect(thBuilding!.assignedBuilder).not.toBeNull();
  });

  it('deducts resources', () => {
    const state = makeVillage();
    const cost = getTownHallUpgradeCost(1);
    const result = startTownHallUpgrade(state);

    expect(result).not.toBeNull();
    expect(result!.resources.gold).toBe(state.resources.gold - cost!.cost);
  });

  it('assigns a builder', () => {
    const state = makeVillage();
    const result = startTownHallUpgrade(state);

    expect(result).not.toBeNull();
    const assignedBuilder = result!.builders.find((b) => b.assignedTo !== null);
    expect(assignedBuilder).toBeDefined();
  });

  it('returns null when TH is already upgrading', () => {
    const state = makeVillage({
      buildings: [makeTownHallBuilding({ isUpgrading: true })],
    });
    expect(startTownHallUpgrade(state)).toBeNull();
  });

  it('returns null when resources are insufficient', () => {
    const state = makeVillage({
      resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 0 },
    });
    expect(startTownHallUpgrade(state)).toBeNull();
  });

  it('returns null when no builders available', () => {
    const state = makeVillage({
      builders: [
        makeBuilder(1, { assignedTo: 'other', timeRemaining: 100 }),
        makeBuilder(2, { assignedTo: 'other', timeRemaining: 100 }),
      ],
    });
    expect(startTownHallUpgrade(state)).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = makeVillage();
    startTownHallUpgrade(state);
    const thBuilding = state.buildings.find((b) => b.buildingId === 'Town Hall');
    expect(thBuilding!.isUpgrading).toBe(false);
    expect(state.resources.gold).toBe(10000000);
  });
});

describe('completeTownHallUpgrade', () => {
  it('increments TH level and building level', () => {
    const state = makeVillage({
      townHallLevel: 1,
      buildings: [makeTownHallBuilding({ isUpgrading: true, assignedBuilder: 1 })],
      builders: [makeBuilder(1, { assignedTo: 'bld_1', timeRemaining: 0 }), makeBuilder(2)],
    });

    const result = completeTownHallUpgrade(state);
    expect(result.townHallLevel).toBe(2);

    const thBuilding = result.buildings.find((b) => b.buildingId === 'Town Hall');
    expect(thBuilding!.level).toBe(2);
    expect(thBuilding!.isUpgrading).toBe(false);
    expect(thBuilding!.assignedBuilder).toBeNull();
  });

  it('frees the assigned builder', () => {
    const state = makeVillage({
      buildings: [makeTownHallBuilding({ isUpgrading: true, assignedBuilder: 1 })],
      builders: [makeBuilder(1, { assignedTo: 'bld_1', timeRemaining: 0 }), makeBuilder(2)],
    });

    const result = completeTownHallUpgrade(state);
    const builder = result.builders.find((b) => b.id === 1);
    expect(builder!.assignedTo).toBeNull();
    expect(builder!.timeRemaining).toBe(0);
  });

  it('returns state unchanged when TH is not upgrading', () => {
    const state = makeVillage();
    const result = completeTownHallUpgrade(state);
    expect(result.townHallLevel).toBe(1);
  });

  it('does not mutate the original state', () => {
    const state = makeVillage({
      townHallLevel: 1,
      buildings: [makeTownHallBuilding({ isUpgrading: true, assignedBuilder: 1 })],
      builders: [makeBuilder(1, { assignedTo: 'bld_1', timeRemaining: 0 }), makeBuilder(2)],
    });
    completeTownHallUpgrade(state);
    expect(state.townHallLevel).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getNextTHUnlockSummary
// ---------------------------------------------------------------------------
describe('getNextTHUnlockSummary', () => {
  it('returns unlock info for TH1 to TH2', () => {
    const summary = getNextTHUnlockSummary(1);
    expect(summary).not.toBeNull();
    expect(summary!.newBuildings).toContain('Archer Tower');
    expect(summary!.newTroops).toContain('Archer');
    expect(summary!.wallIncrease).toBe(25); // TH2 has 25 walls, TH1 has 0
  });

  it('returns null for max TH level', () => {
    const max = getMaxTownHallLevel();
    expect(getNextTHUnlockSummary(max)).toBeNull();
  });

  it('includes army camp capacity increase', () => {
    const summary = getNextTHUnlockSummary(1);
    expect(summary).not.toBeNull();
    expect(summary!.armyCampCapacityIncrease).toBeGreaterThan(0);
  });

  it('returns null for invalid level', () => {
    expect(getNextTHUnlockSummary(999)).toBeNull();
  });
});
