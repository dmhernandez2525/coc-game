import type { VillageState, PlacedBuilding } from '../../types/village.ts';
import {
  getAllSiegeMachines,
  getSiegeMachine,
  areSiegeMachinesAvailable,
  getWorkshopLevel,
  canTrainSiege,
  getAvailableSiegeMachines,
  deploySiegeMachine,
  getMaxSiegePerAttack,
  getMinTHForSiege,
} from '../siege-manager.ts';

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
    townHallLevel: 12,
    buildings: [
      makeBuilding('Workshop', 'army', 3),
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
// getAllSiegeMachines
// ---------------------------------------------------------------------------

describe('getAllSiegeMachines', () => {
  it('returns an array of siege machine data', () => {
    const machines = getAllSiegeMachines();

    expect(Array.isArray(machines)).toBe(true);
    expect(machines.length).toBeGreaterThan(0);
  });

  it('includes Wall Wrecker in the list', () => {
    const machines = getAllSiegeMachines();
    const names = machines.map((m) => m.name);

    expect(names).toContain('Wall Wrecker');
  });

  it('returns a new array each call (does not leak internal state)', () => {
    const first = getAllSiegeMachines();
    const second = getAllSiegeMachines();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// getSiegeMachine
// ---------------------------------------------------------------------------

describe('getSiegeMachine', () => {
  it('returns data for a valid siege machine name', () => {
    const machine = getSiegeMachine('Wall Wrecker');

    expect(machine).toBeDefined();
    expect(machine!.name).toBe('Wall Wrecker');
    expect(machine!.workshopLevelRequired).toBe(1);
  });

  it('returns data for Battle Blimp', () => {
    const machine = getSiegeMachine('Battle Blimp');

    expect(machine).toBeDefined();
    expect(machine!.isFlying).toBe(true);
  });

  it('returns undefined for an unknown siege machine name', () => {
    const machine = getSiegeMachine('Nonexistent Siege');

    expect(machine).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// areSiegeMachinesAvailable
// ---------------------------------------------------------------------------

describe('areSiegeMachinesAvailable', () => {
  it('returns false below TH12', () => {
    expect(areSiegeMachinesAvailable(1)).toBe(false);
    expect(areSiegeMachinesAvailable(11)).toBe(false);
  });

  it('returns true at TH12', () => {
    expect(areSiegeMachinesAvailable(12)).toBe(true);
  });

  it('returns true above TH12', () => {
    expect(areSiegeMachinesAvailable(13)).toBe(true);
    expect(areSiegeMachinesAvailable(16)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getWorkshopLevel
// ---------------------------------------------------------------------------

describe('getWorkshopLevel', () => {
  it('returns 0 when there is no Workshop building', () => {
    const state = makeVillage({ buildings: [] });
    const level = getWorkshopLevel(state);

    expect(level).toBe(0);
  });

  it('returns the correct level when a Workshop is present', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Workshop', 'army', 5)],
    });
    const level = getWorkshopLevel(state);

    expect(level).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// canTrainSiege
// ---------------------------------------------------------------------------

describe('canTrainSiege', () => {
  it('returns false when TH level is below 12', () => {
    const state = makeVillage({
      townHallLevel: 11,
      buildings: [makeBuilding('Workshop', 'army', 3)],
    });

    expect(canTrainSiege(state, 'Wall Wrecker')).toBe(false);
  });

  it('returns false when there is no Workshop', () => {
    const state = makeVillage({ buildings: [] });

    expect(canTrainSiege(state, 'Wall Wrecker')).toBe(false);
  });

  it('returns false for an unknown siege machine name', () => {
    const state = makeVillage();

    expect(canTrainSiege(state, 'Fake Machine')).toBe(false);
  });

  it('returns false when workshop level is too low for the siege machine', () => {
    // Stone Slammer requires workshop level 3, give workshop level 2
    const state = makeVillage({
      buildings: [makeBuilding('Workshop', 'army', 2)],
    });

    expect(canTrainSiege(state, 'Stone Slammer')).toBe(false);
  });

  it('returns true when TH and workshop requirements are met', () => {
    // Wall Wrecker requires workshop level 1, give workshop level 3
    const state = makeVillage();

    expect(canTrainSiege(state, 'Wall Wrecker')).toBe(true);
  });

  it('returns true when workshop level exactly matches the requirement', () => {
    // Battle Blimp requires workshop level 2
    const state = makeVillage({
      buildings: [makeBuilding('Workshop', 'army', 2)],
    });

    expect(canTrainSiege(state, 'Battle Blimp')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAvailableSiegeMachines
// ---------------------------------------------------------------------------

describe('getAvailableSiegeMachines', () => {
  it('returns empty array when TH is below 12', () => {
    const state = makeVillage({
      townHallLevel: 10,
      buildings: [makeBuilding('Workshop', 'army', 3)],
    });
    const available = getAvailableSiegeMachines(state);

    expect(available).toEqual([]);
  });

  it('returns empty array when there is no Workshop', () => {
    const state = makeVillage({ buildings: [] });
    const available = getAvailableSiegeMachines(state);

    expect(available).toEqual([]);
  });

  it('returns only Wall Wrecker for workshop level 1', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Workshop', 'army', 1)],
    });
    const available = getAvailableSiegeMachines(state);
    const names = available.map((s) => s.name);

    expect(names).toContain('Wall Wrecker');
    expect(names).not.toContain('Battle Blimp');
  });

  it('returns machines up to workshop level 3', () => {
    const state = makeVillage({
      buildings: [makeBuilding('Workshop', 'army', 3)],
    });
    const available = getAvailableSiegeMachines(state);
    const names = available.map((s) => s.name);

    expect(names).toContain('Wall Wrecker');
    expect(names).toContain('Battle Blimp');
    expect(names).toContain('Stone Slammer');
    expect(names).not.toContain('Siege Barracks');
  });
});

// ---------------------------------------------------------------------------
// deploySiegeMachine
// ---------------------------------------------------------------------------

describe('deploySiegeMachine', () => {
  it('creates a DeployedTroop with correct properties', () => {
    const troop = deploySiegeMachine('Wall Wrecker', 1, 5, 10);

    expect(troop).not.toBeNull();
    expect(troop!.name).toBe('Wall Wrecker');
    expect(troop!.level).toBe(1);
    expect(troop!.x).toBe(5);
    expect(troop!.y).toBe(10);
    expect(troop!.state).toBe('idle');
    expect(troop!.targetId).toBeNull();
  });

  it('sets correct HP from level stats', () => {
    // Wall Wrecker level 1: hp = 5500
    const troop = deploySiegeMachine('Wall Wrecker', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.currentHp).toBe(5500);
    expect(troop!.maxHp).toBe(5500);
  });

  it('sets correct DPS from level stats', () => {
    // Wall Wrecker level 1: dps = 250
    const troop = deploySiegeMachine('Wall Wrecker', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.dps).toBe(250);
    expect(troop!.baseDps).toBe(250);
  });

  it('returns null for an unknown siege machine name', () => {
    const troop = deploySiegeMachine('Nonexistent Machine', 1, 0, 0);

    expect(troop).toBeNull();
  });

  it('returns null for an invalid level', () => {
    const troop = deploySiegeMachine('Wall Wrecker', 99, 0, 0);

    expect(troop).toBeNull();
  });

  it('sets canJumpWalls to true', () => {
    const troop = deploySiegeMachine('Wall Wrecker', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.canJumpWalls).toBe(true);
  });

  it('sets isFlying based on siege machine data', () => {
    const ground = deploySiegeMachine('Wall Wrecker', 1, 0, 0);
    const flying = deploySiegeMachine('Battle Blimp', 1, 0, 0);

    expect(ground!.isFlying).toBe(false);
    expect(flying!.isFlying).toBe(true);
  });

  it('sets movementSpeed from siege machine data', () => {
    // Wall Wrecker movementSpeed = 12, Battle Blimp = 18
    const wrecker = deploySiegeMachine('Wall Wrecker', 1, 0, 0);
    const blimp = deploySiegeMachine('Battle Blimp', 1, 0, 0);

    expect(wrecker!.movementSpeed).toBe(12);
    expect(blimp!.movementSpeed).toBe(18);
  });

  it('sets deathDamage from level stats when present', () => {
    // Battle Blimp level 1: deathDamage = 700
    const troop = deploySiegeMachine('Battle Blimp', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.deathDamage).toBe(700);
  });

  it('generates a unique id containing the siege name', () => {
    const troop = deploySiegeMachine('Wall Wrecker', 1, 0, 0);

    expect(troop).not.toBeNull();
    expect(troop!.id).toContain('siege_Wall Wrecker_');
  });
});

// ---------------------------------------------------------------------------
// getMaxSiegePerAttack
// ---------------------------------------------------------------------------

describe('getMaxSiegePerAttack', () => {
  it('returns 1', () => {
    expect(getMaxSiegePerAttack()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getMinTHForSiege
// ---------------------------------------------------------------------------

describe('getMinTHForSiege', () => {
  it('returns 12', () => {
    expect(getMinTHForSiege()).toBe(12);
  });
});
