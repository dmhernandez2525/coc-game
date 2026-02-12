import type { VillageState } from '../../types/village.ts';
import { resetInstanceCounter } from '../village-helpers.ts';
import {
  createStarterVillage,
  placeBuilding,
  removeBuilding,
  moveBuilding,
  startUpgrade,
  completeUpgrade,
  canAffordUpgrade,
  getAvailableBuildingCount,
} from '../village-manager.ts';

beforeEach(() => {
  resetInstanceCounter();
});

// ---------------------------------------------------------------------------
// Helper: enrich a starter village with extra resources for upgrade tests
// ---------------------------------------------------------------------------
function richVillage(overrides: Partial<VillageState['resources']> = {}): VillageState {
  const state = createStarterVillage();
  return {
    ...state,
    resources: { ...state.resources, gold: 50_000, elixir: 50_000, ...overrides },
  };
}

// ===========================================================================
// createStarterVillage
// ===========================================================================
describe('createStarterVillage', () => {
  it('creates exactly 9 buildings', () => {
    const state = createStarterVillage();
    expect(state.buildings).toHaveLength(9);
  });

  it('includes all expected building types', () => {
    const state = createStarterVillage();
    const ids = state.buildings.map((b) => b.buildingId);

    expect(ids).toContain('Town Hall');
    expect(ids).toContain('Gold Mine');
    expect(ids).toContain('Elixir Collector');
    expect(ids).toContain('Gold Storage');
    expect(ids).toContain('Elixir Storage');
    expect(ids).toContain('Army Camp');
    expect(ids).toContain('Barracks');
    expect(ids.filter((id) => id === 'Cannon')).toHaveLength(2);
  });

  it('sets starting resources to 500g, 500e, 0de, 250 gems', () => {
    const state = createStarterVillage();
    expect(state.resources).toEqual({
      gold: 500,
      elixir: 500,
      darkElixir: 0,
      gems: 250,
    });
  });

  it('unlocks exactly 2 builders', () => {
    const state = createStarterVillage();
    const unlocked = state.builders.filter((b) => b.isUnlocked);
    expect(unlocked).toHaveLength(2);
    expect(unlocked[0]?.id).toBe(1);
    expect(unlocked[1]?.id).toBe(2);
  });

  it('produces deterministic instance IDs starting at bld_1', () => {
    const state = createStarterVillage();
    const instanceIds = state.buildings.map((b) => b.instanceId);
    expect(instanceIds[0]).toBe('bld_1');
    expect(instanceIds[8]).toBe('bld_9');
  });

  it('generates the same IDs on repeated calls (counter resets)', () => {
    const first = createStarterVillage();
    const second = createStarterVillage();
    expect(first.buildings.map((b) => b.instanceId)).toEqual(
      second.buildings.map((b) => b.instanceId),
    );
  });

  it('sets townHallLevel to 1', () => {
    const state = createStarterVillage();
    expect(state.townHallLevel).toBe(1);
  });

  it('initializes all buildings at level 1 with no upgrade in progress', () => {
    const state = createStarterVillage();
    for (const b of state.buildings) {
      expect(b.level).toBe(1);
      expect(b.isUpgrading).toBe(false);
      expect(b.assignedBuilder).toBeNull();
    }
  });
});

// ===========================================================================
// placeBuilding
// ===========================================================================
describe('placeBuilding', () => {
  it('successfully places a building on an empty tile and deducts resources', () => {
    // At TH2 we can place a second Gold Mine. Use TH2 state for this test.
    const starter = richVillage();
    const state: VillageState = { ...starter, townHallLevel: 2 };
    const result = placeBuilding(state, 'Gold Mine', 'resource_collector', 0, 0);

    expect(result).not.toBeNull();
    expect(result!.buildings).toHaveLength(state.buildings.length + 1);

    // The new building should be the last one in the array
    const placed = result!.buildings[result!.buildings.length - 1];
    expect(placed?.buildingId).toBe('Gold Mine');
    expect(placed?.gridX).toBe(0);
    expect(placed?.gridY).toBe(0);
    expect(placed?.level).toBe(1);
  });

  it('deducts the level 1 cost from resources', () => {
    // Gold Mine level 1 costs 150 Elixir
    const starter = richVillage();
    const state: VillageState = { ...starter, townHallLevel: 2 };
    const result = placeBuilding(state, 'Gold Mine', 'resource_collector', 0, 0);

    expect(result).not.toBeNull();
    expect(result!.resources.elixir).toBe(state.resources.elixir - 150);
  });

  it('returns null when placing on a tile occupied by another building', () => {
    // The Town Hall sits at (20, 20) and is 4x4, occupying tiles 20-23 in each axis.
    const state: VillageState = { ...richVillage(), townHallLevel: 2 };
    const result = placeBuilding(state, 'Gold Mine', 'resource_collector', 21, 21);

    expect(result).toBeNull();
  });

  it('returns null when max count for TH level is reached', () => {
    // TH1 allows only 1 Gold Mine, and the starter village already has 1
    const state = richVillage();
    const result = placeBuilding(state, 'Gold Mine', 'resource_collector', 0, 0);

    expect(result).toBeNull();
  });

  it('returns null when player cannot afford the building', () => {
    // Cannon costs 250 gold. Give player 0 gold.
    const starter = createStarterVillage();
    const state: VillageState = {
      ...starter,
      townHallLevel: 2,
      resources: { ...starter.resources, gold: 0, elixir: 0 },
    };
    // TH2 allows up to 2 Cannons, starter has 2 at TH1 buildingCounts. Bump to TH5 for 3 Cannons.
    const state5: VillageState = {
      ...state,
      townHallLevel: 5,
    };
    const result = placeBuilding(state5, 'Cannon', 'defense', 0, 0);

    expect(result).toBeNull();
  });

  it('returns null when placement is out of grid bounds', () => {
    // Place a 3x3 building at (43, 43) so it would extend to (45, 45), out of the 44x44 grid
    const state: VillageState = { ...richVillage(), townHallLevel: 2 };
    const result = placeBuilding(state, 'Gold Mine', 'resource_collector', 43, 43);

    expect(result).toBeNull();
  });
});

// ===========================================================================
// removeBuilding
// ===========================================================================
describe('removeBuilding', () => {
  it('removes the building with the given instanceId', () => {
    const state = createStarterVillage();
    const target = state.buildings[0];
    expect(target).toBeDefined();

    const result = removeBuilding(state, target!.instanceId);
    expect(result.buildings).toHaveLength(state.buildings.length - 1);
    expect(result.buildings.find((b) => b.instanceId === target!.instanceId)).toBeUndefined();
  });

  it('returns state unchanged when instanceId does not exist', () => {
    const state = createStarterVillage();
    const result = removeBuilding(state, 'nonexistent_id');
    expect(result.buildings).toHaveLength(state.buildings.length);
  });
});

// ===========================================================================
// moveBuilding
// ===========================================================================
describe('moveBuilding', () => {
  it('moves a building to a valid empty position', () => {
    const state = createStarterVillage();
    // Move the first cannon (bld_8 at 18,17) to the top-left corner (0, 0)
    const cannon = state.buildings.find((b) => b.instanceId === 'bld_8');
    expect(cannon).toBeDefined();

    const result = moveBuilding(state, 'bld_8', 0, 0);
    expect(result).not.toBeNull();

    const moved = result!.buildings.find((b) => b.instanceId === 'bld_8');
    expect(moved?.gridX).toBe(0);
    expect(moved?.gridY).toBe(0);
  });

  it('returns null when moving to an occupied position', () => {
    const state = createStarterVillage();
    // Try moving the first cannon onto the Town Hall at (20, 20)
    const result = moveBuilding(state, 'bld_8', 20, 20);
    expect(result).toBeNull();
  });

  it('returns null when moving out of grid bounds', () => {
    const state = createStarterVillage();
    // Cannon is 3x3, placing at (42, 42) would go to (44, 44) which is out of bounds
    const result = moveBuilding(state, 'bld_8', 42, 42);
    expect(result).toBeNull();
  });

  it('returns null for a non-existent instanceId', () => {
    const state = createStarterVillage();
    const result = moveBuilding(state, 'nonexistent', 0, 0);
    expect(result).toBeNull();
  });

  it('does not modify the original state (immutability)', () => {
    const state = createStarterVillage();
    const originalX = state.buildings.find((b) => b.instanceId === 'bld_8')?.gridX;
    moveBuilding(state, 'bld_8', 0, 0);
    const afterX = state.buildings.find((b) => b.instanceId === 'bld_8')?.gridX;
    expect(afterX).toBe(originalX);
  });
});

// ===========================================================================
// startUpgrade
// ===========================================================================
describe('startUpgrade', () => {
  it('starts an upgrade when resources and builder are available', () => {
    // Cannon level 2 costs 1000 gold, 120 seconds
    const state = richVillage();
    const cannon = state.buildings.find((b) => b.instanceId === 'bld_8');
    expect(cannon).toBeDefined();

    const result = startUpgrade(state, 'bld_8');
    expect(result).not.toBeNull();

    const upgraded = result!.buildings.find((b) => b.instanceId === 'bld_8');
    expect(upgraded?.isUpgrading).toBe(true);
    expect(upgraded?.upgradeTimeRemaining).toBe(120);
    expect(upgraded?.assignedBuilder).toBeTypeOf('number');
  });

  it('deducts the upgrade cost from resources', () => {
    const state = richVillage();
    const result = startUpgrade(state, 'bld_8');

    expect(result).not.toBeNull();
    // Cannon level 2 costs 1000 gold
    expect(result!.resources.gold).toBe(state.resources.gold - 1000);
  });

  it('assigns a builder to the upgrade', () => {
    const state = richVillage();
    const result = startUpgrade(state, 'bld_8');
    expect(result).not.toBeNull();

    const assignedBuilder = result!.builders.find(
      (b) => b.assignedTo === 'bld_8',
    );
    expect(assignedBuilder).toBeDefined();
    expect(assignedBuilder?.timeRemaining).toBe(120);
  });

  it('returns null when player cannot afford the upgrade', () => {
    const state = createStarterVillage();
    // Starter has 500 gold, Cannon upgrade to level 2 costs 1000 gold
    const result = startUpgrade(state, 'bld_8');
    expect(result).toBeNull();
  });

  it('returns null when no builder is available', () => {
    const state = richVillage();
    // Occupy both builders
    const stateWithBusyBuilders: VillageState = {
      ...state,
      builders: state.builders.map((b) =>
        b.isUnlocked ? { ...b, assignedTo: 'some_building', timeRemaining: 100 } : b,
      ),
    };

    const result = startUpgrade(stateWithBusyBuilders, 'bld_8');
    expect(result).toBeNull();
  });

  it('returns null when building is already upgrading', () => {
    const state = richVillage();
    // Start the first upgrade
    const afterFirst = startUpgrade(state, 'bld_8');
    expect(afterFirst).not.toBeNull();

    // Try to start it again
    const afterSecond = startUpgrade(afterFirst!, 'bld_8');
    expect(afterSecond).toBeNull();
  });
});

// ===========================================================================
// completeUpgrade
// ===========================================================================
describe('completeUpgrade', () => {
  it('increments the building level by 1', () => {
    const state = richVillage();
    const afterStart = startUpgrade(state, 'bld_8');
    expect(afterStart).not.toBeNull();

    const afterComplete = completeUpgrade(afterStart!, 'bld_8');
    const building = afterComplete.buildings.find((b) => b.instanceId === 'bld_8');
    expect(building?.level).toBe(2);
  });

  it('clears the upgrade state on the building', () => {
    const state = richVillage();
    const afterStart = startUpgrade(state, 'bld_8');
    expect(afterStart).not.toBeNull();

    const afterComplete = completeUpgrade(afterStart!, 'bld_8');
    const building = afterComplete.buildings.find((b) => b.instanceId === 'bld_8');
    expect(building?.isUpgrading).toBe(false);
    expect(building?.upgradeTimeRemaining).toBe(0);
    expect(building?.assignedBuilder).toBeNull();
  });

  it('frees the builder that was assigned', () => {
    const state = richVillage();
    const afterStart = startUpgrade(state, 'bld_8');
    expect(afterStart).not.toBeNull();

    // Find which builder was assigned
    const assignedBuilder = afterStart!.builders.find(
      (b) => b.assignedTo === 'bld_8',
    );
    expect(assignedBuilder).toBeDefined();

    const afterComplete = completeUpgrade(afterStart!, 'bld_8');
    const freedBuilder = afterComplete.builders.find(
      (b) => b.id === assignedBuilder!.id,
    );
    expect(freedBuilder?.assignedTo).toBeNull();
    expect(freedBuilder?.timeRemaining).toBe(0);
  });

  it('returns state unchanged for a non-existent instanceId', () => {
    const state = createStarterVillage();
    const result = completeUpgrade(state, 'nonexistent');
    expect(result.buildings).toEqual(state.buildings);
  });
});

// ===========================================================================
// canAffordUpgrade
// ===========================================================================
describe('canAffordUpgrade', () => {
  it('returns true when the player has enough resources', () => {
    // Cannon level 2 costs 1000 gold
    const state = richVillage();
    expect(canAffordUpgrade(state, 'Cannon', 1)).toBe(true);
  });

  it('returns false when the player cannot afford it', () => {
    const state = createStarterVillage();
    // Cannon level 2 costs 1000 gold, starter only has 500
    expect(canAffordUpgrade(state, 'Cannon', 1)).toBe(false);
  });

  it('returns false for a building or level that does not exist', () => {
    const state = richVillage();
    expect(canAffordUpgrade(state, 'FakeBuilding', 1)).toBe(false);
  });

  it('returns true for an upgrade costing elixir when elixir is sufficient', () => {
    // Gold Mine level 2 costs 300 elixir
    const state = richVillage();
    expect(canAffordUpgrade(state, 'Gold Mine', 1)).toBe(true);
  });
});

// ===========================================================================
// getAvailableBuildingCount
// ===========================================================================
describe('getAvailableBuildingCount', () => {
  it('returns 0 when the max count is already reached', () => {
    const state = createStarterVillage();
    // TH1 allows 1 Gold Mine and we already have 1
    expect(getAvailableBuildingCount(state, 'Gold Mine')).toBe(0);
  });

  it('returns remaining count when below max', () => {
    const state = createStarterVillage();
    // TH1 allows 2 Cannons and we have 2, so 0 remaining
    expect(getAvailableBuildingCount(state, 'Cannon')).toBe(0);

    // At TH2, the max for Gold Mine is 2 and we have 1
    const th2: VillageState = { ...state, townHallLevel: 2 };
    expect(getAvailableBuildingCount(th2, 'Gold Mine')).toBe(1);
  });

  it('returns 0 for a building not allowed at the current TH level', () => {
    const state = createStarterVillage();
    // Archer Tower is not available at TH1 (count is 0)
    expect(getAvailableBuildingCount(state, 'Archer Tower')).toBe(0);
  });

  it('returns 0 for an unrecognized building name', () => {
    const state = createStarterVillage();
    expect(getAvailableBuildingCount(state, 'FakeBuilding')).toBe(0);
  });
});
