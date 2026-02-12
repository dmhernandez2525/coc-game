// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGameStore } from '../game-store.ts';
import type { VillageState, PlacedBuilding, TrainedTroop } from '../../types/village.ts';
import type { SuperTroopState, SuperTroopBoost } from '../../engine/super-troop-manager.ts';
import type { MagicItemInventory } from '../../engine/magic-items-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clone the initial store state once at module load so we have a
 * pristine copy to restore before every test.
 */
const initialState = useGameStore.getState();
const initialVillage: VillageState = JSON.parse(JSON.stringify(initialState.village));
const initialStorageCaps = { ...initialState.storageCaps };

function makeBuilding(overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: 'test_bld_1',
    buildingId: 'Cannon',
    buildingType: 'defense',
    level: 1,
    gridX: 10,
    gridY: 10,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeCollector(overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: 'test_collector_1',
    buildingId: 'Gold Mine',
    buildingType: 'resource_collector',
    level: 1,
    gridX: 5,
    gridY: 5,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeStorage(name: string, overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: `test_${name}`,
    buildingId: name,
    buildingType: 'resource_storage',
    level: 1,
    gridX: 15,
    gridY: 15,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeVillageState(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 1,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 500, elixir: 500, darkElixir: 0, gems: 250 },
    builders: [
      { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
      { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
      { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
    ],
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

beforeEach(() => {
  // Deep-clone the initial village so every test starts from a clean slate.
  const freshVillage: VillageState = JSON.parse(JSON.stringify(initialVillage));
  useGameStore.setState({
    village: freshVillage,
    superTroopState: { activeBoosts: [] },
    inventory: { items: {} },
    storageCaps: { ...initialStorageCaps },
  });
  localStorage.clear();
});

afterEach(() => {
  useGameStore.getState().disableAutoSave();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('creates a village with TH level 1', () => {
    const { village } = useGameStore.getState();
    expect(village.townHallLevel).toBe(1);
  });

  it('starts with the expected starter buildings', () => {
    const { village } = useGameStore.getState();
    // createStarterVillage places 9 buildings: TH, Gold Mine, Elixir Collector,
    // Gold Storage, Elixir Storage, Army Camp, Barracks, 2x Cannon
    expect(village.buildings.length).toBe(9);

    const ids = village.buildings.map((b) => b.buildingId);
    expect(ids).toContain('Town Hall');
    expect(ids).toContain('Gold Mine');
    expect(ids).toContain('Elixir Collector');
    expect(ids).toContain('Gold Storage');
    expect(ids).toContain('Elixir Storage');
    expect(ids).toContain('Army Camp');
    expect(ids).toContain('Barracks');
    expect(ids.filter((id) => id === 'Cannon').length).toBe(2);
  });

  it('starts with 500 gold, 500 elixir, 0 dark elixir, 250 gems', () => {
    const { village } = useGameStore.getState();
    expect(village.resources.gold).toBe(500);
    expect(village.resources.elixir).toBe(500);
    expect(village.resources.darkElixir).toBe(0);
    expect(village.resources.gems).toBe(250);
  });

  it('has 2 unlocked builders and 3 locked builders', () => {
    const { village } = useGameStore.getState();
    const unlocked = village.builders.filter((b) => b.isUnlocked);
    const locked = village.builders.filter((b) => !b.isUnlocked);
    expect(unlocked.length).toBe(2);
    expect(locked.length).toBe(3);
  });

  it('computes storage capacity from starter buildings', () => {
    const { storageCaps } = useGameStore.getState();
    // Storage caps should be > 0 for gold and elixir because of the storage buildings + TH bonus
    expect(storageCaps.gold).toBeGreaterThan(0);
    expect(storageCaps.elixir).toBeGreaterThan(0);
    // Gems storage is always Infinity
    expect(storageCaps.gems).toBe(Infinity);
  });

  it('starts with empty army, spells, and heroes', () => {
    const { village } = useGameStore.getState();
    expect(village.army).toEqual([]);
    expect(village.spells).toEqual([]);
    expect(village.heroes).toEqual([]);
  });

  it('starts with empty super troop state', () => {
    const { superTroopState } = useGameStore.getState();
    expect(superTroopState.activeBoosts).toEqual([]);
  });

  it('starts with empty inventory', () => {
    const { inventory } = useGameStore.getState();
    expect(inventory.items).toEqual({});
  });

  it('starts with 0 trophies and Unranked league', () => {
    const { village } = useGameStore.getState();
    expect(village.trophies).toBe(0);
    expect(village.league).toBe('Unranked');
  });
});

// ---------------------------------------------------------------------------
// setVillageState
// ---------------------------------------------------------------------------

describe('setVillageState', () => {
  it('replaces the entire village state', () => {
    const custom = makeVillageState({ townHallLevel: 5, trophies: 999 });
    useGameStore.getState().setVillageState(custom);

    const { village } = useGameStore.getState();
    expect(village.townHallLevel).toBe(5);
    expect(village.trophies).toBe(999);
  });

  it('recomputes storage caps when village state changes', () => {
    const capsBefore = useGameStore.getState().storageCaps;

    // Set a village with storage buildings at higher level
    const custom = makeVillageState({
      buildings: [
        makeStorage('Gold Storage', { level: 5 }),
        makeStorage('Elixir Storage', { level: 5, instanceId: 'test_Elixir Storage' }),
      ],
    });
    useGameStore.getState().setVillageState(custom);

    const capsAfter = useGameStore.getState().storageCaps;
    // The new caps may differ from original; at minimum they are recomputed (not stale)
    expect(capsAfter).toBeDefined();
    expect(typeof capsAfter.gold).toBe('number');
    expect(typeof capsAfter.elixir).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// placeBuilding / removeBuilding
// ---------------------------------------------------------------------------

describe('placeBuilding', () => {
  it('appends a building to the buildings array', () => {
    const countBefore = useGameStore.getState().village.buildings.length;
    const newBuilding = makeBuilding({ instanceId: 'new_cannon_99' });

    useGameStore.getState().placeBuilding(newBuilding);

    const { village } = useGameStore.getState();
    expect(village.buildings.length).toBe(countBefore + 1);
    expect(village.buildings.find((b) => b.instanceId === 'new_cannon_99')).toBeDefined();
  });

  it('recomputes storage caps after placing a storage building', () => {
    const capsBefore = { ...useGameStore.getState().storageCaps };
    const storageBuilding = makeStorage('Gold Storage', { instanceId: 'extra_gold_storage', level: 1 });

    useGameStore.getState().placeBuilding(storageBuilding);

    const capsAfter = useGameStore.getState().storageCaps;
    // Adding another Gold Storage should increase gold cap
    expect(capsAfter.gold).toBeGreaterThanOrEqual(capsBefore.gold);
  });
});

describe('removeBuilding', () => {
  it('removes a building by instanceId', () => {
    const { village } = useGameStore.getState();
    const firstBuilding = village.buildings[0]!;
    const countBefore = village.buildings.length;

    useGameStore.getState().removeBuilding(firstBuilding.instanceId);

    const after = useGameStore.getState().village;
    expect(after.buildings.length).toBe(countBefore - 1);
    expect(after.buildings.find((b) => b.instanceId === firstBuilding.instanceId)).toBeUndefined();
  });

  it('does nothing when instanceId does not exist', () => {
    const countBefore = useGameStore.getState().village.buildings.length;

    useGameStore.getState().removeBuilding('nonexistent_id');

    expect(useGameStore.getState().village.buildings.length).toBe(countBefore);
  });

  it('recomputes storage caps after removing a storage building', () => {
    // Find a storage building in the initial village
    const storageBuilding = useGameStore.getState().village.buildings.find(
      (b) => b.buildingType === 'resource_storage',
    );
    expect(storageBuilding).toBeDefined();

    const capsBefore = { ...useGameStore.getState().storageCaps };

    useGameStore.getState().removeBuilding(storageBuilding!.instanceId);

    const capsAfter = useGameStore.getState().storageCaps;
    // Removing a storage should reduce (or keep equal to) the storage cap
    expect(capsAfter.gold).toBeLessThanOrEqual(capsBefore.gold);
  });
});

// ---------------------------------------------------------------------------
// addResources / spendResources
// ---------------------------------------------------------------------------

describe('addResources', () => {
  it('adds the specified amount of gold', () => {
    const goldBefore = useGameStore.getState().village.resources.gold;
    useGameStore.getState().addResources({ gold: 100 });

    expect(useGameStore.getState().village.resources.gold).toBe(goldBefore + 100);
  });

  it('adds multiple resource types at once', () => {
    const before = { ...useGameStore.getState().village.resources };
    useGameStore.getState().addResources({ gold: 50, elixir: 75, gems: 10 });

    const after = useGameStore.getState().village.resources;
    expect(after.gold).toBe(before.gold + 50);
    expect(after.elixir).toBe(before.elixir + 75);
    expect(after.gems).toBe(before.gems + 10);
  });

  it('caps resources at storage limits', () => {
    const caps = useGameStore.getState().storageCaps;
    // Try to add way more gold than the storage can hold
    useGameStore.getState().addResources({ gold: 999_999_999 });

    expect(useGameStore.getState().village.resources.gold).toBe(caps.gold);
  });

  it('does not cap gems (gems storage is Infinity)', () => {
    useGameStore.getState().addResources({ gems: 100_000 });
    const gems = useGameStore.getState().village.resources.gems;
    // Gems should just be the initial 250 + 100000
    expect(gems).toBe(250 + 100_000);
  });

  it('does not modify unspecified resources', () => {
    const elixirBefore = useGameStore.getState().village.resources.elixir;
    useGameStore.getState().addResources({ gold: 100 });

    expect(useGameStore.getState().village.resources.elixir).toBe(elixirBefore);
  });
});

describe('spendResources', () => {
  it('deducts resources when sufficient funds are available', () => {
    const goldBefore = useGameStore.getState().village.resources.gold;
    const result = useGameStore.getState().spendResources({ gold: 100 });

    expect(result).toBe(true);
    expect(useGameStore.getState().village.resources.gold).toBe(goldBefore - 100);
  });

  it('returns false and does not deduct when insufficient gold', () => {
    const goldBefore = useGameStore.getState().village.resources.gold;
    const result = useGameStore.getState().spendResources({ gold: goldBefore + 1 });

    expect(result).toBe(false);
    expect(useGameStore.getState().village.resources.gold).toBe(goldBefore);
  });

  it('returns false and does not deduct when insufficient elixir', () => {
    const result = useGameStore.getState().spendResources({ elixir: 999_999 });

    expect(result).toBe(false);
    // Elixir should remain unchanged
    expect(useGameStore.getState().village.resources.elixir).toBe(500);
  });

  it('returns false when insufficient gems', () => {
    const result = useGameStore.getState().spendResources({ gems: 99_999 });
    expect(result).toBe(false);
  });

  it('deducts multiple resource types atomically', () => {
    const before = { ...useGameStore.getState().village.resources };
    const result = useGameStore.getState().spendResources({ gold: 100, elixir: 200 });

    expect(result).toBe(true);
    const after = useGameStore.getState().village.resources;
    expect(after.gold).toBe(before.gold - 100);
    expect(after.elixir).toBe(before.elixir - 200);
  });

  it('handles zero amounts correctly', () => {
    const before = { ...useGameStore.getState().village.resources };
    const result = useGameStore.getState().spendResources({ gold: 0 });

    expect(result).toBe(true);
    expect(useGameStore.getState().village.resources.gold).toBe(before.gold);
  });
});

// ---------------------------------------------------------------------------
// tick - resource production
// ---------------------------------------------------------------------------

describe('tick - resource production', () => {
  it('advances totalPlayTime by deltaMs', () => {
    const playTimeBefore = useGameStore.getState().village.totalPlayTime;
    useGameStore.getState().tick(5000);

    expect(useGameStore.getState().village.totalPlayTime).toBe(playTimeBefore + 5000);
  });

  it('increases uncollectedResources on resource collectors', () => {
    // The starter village has Gold Mine and Elixir Collector
    const goldMine = useGameStore.getState().village.buildings.find(
      (b) => b.buildingId === 'Gold Mine',
    );
    expect(goldMine).toBeDefined();

    const uncollectedBefore = goldMine!.uncollectedResources ?? 0;

    // Tick for a long period (1 hour = 3,600,000 ms) to see production
    useGameStore.getState().tick(3_600_000);

    const goldMineAfter = useGameStore.getState().village.buildings.find(
      (b) => b.buildingId === 'Gold Mine',
    );
    const uncollectedAfter = goldMineAfter!.uncollectedResources ?? 0;

    expect(uncollectedAfter).toBeGreaterThan(uncollectedBefore);
  });

  it('does not produce resources for upgrading collectors', () => {
    // Manually set a collector to upgrading state
    const village = useGameStore.getState().village;
    const collector = village.buildings.find((b) => b.buildingId === 'Gold Mine');
    expect(collector).toBeDefined();

    const updatedBuildings = village.buildings.map((b) =>
      b.instanceId === collector!.instanceId
        ? { ...b, isUpgrading: true, upgradeTimeRemaining: 60000, uncollectedResources: 0 }
        : b,
    );
    useGameStore.getState().setVillageState({ ...village, buildings: updatedBuildings });

    useGameStore.getState().tick(3_600_000);

    const afterTick = useGameStore.getState().village.buildings.find(
      (b) => b.instanceId === collector!.instanceId,
    );
    // Should remain 0 since upgrading collectors don't produce
    expect(afterTick!.uncollectedResources ?? 0).toBe(0);
  });

  it('respects gameClockSpeed multiplier', () => {
    // Set gameClockSpeed to 2x
    const village = useGameStore.getState().village;
    useGameStore.getState().setVillageState({ ...village, gameClockSpeed: 2 });

    // Tick with speed 2x for 1 hour
    useGameStore.getState().tick(3_600_000);
    const goldMineAt2x = useGameStore.getState().village.buildings.find(
      (b) => b.buildingId === 'Gold Mine',
    );
    const uncollected2x = goldMineAt2x!.uncollectedResources ?? 0;

    // Reset and tick with speed 1x for 1 hour
    useGameStore.setState({
      village: { ...village, gameClockSpeed: 1 },
      storageCaps: useGameStore.getState().storageCaps,
    });
    useGameStore.getState().tick(3_600_000);
    const goldMineAt1x = useGameStore.getState().village.buildings.find(
      (b) => b.buildingId === 'Gold Mine',
    );
    const uncollected1x = goldMineAt1x!.uncollectedResources ?? 0;

    // 2x speed should produce about 2x the resources
    expect(uncollected2x).toBeGreaterThan(uncollected1x);
  });
});

// ---------------------------------------------------------------------------
// tick - builder timers
// ---------------------------------------------------------------------------

describe('tick - builder timers', () => {
  it('decrements builder timeRemaining on each tick', () => {
    // Set up a builder with an active task
    const village = useGameStore.getState().village;
    const updatedBuilders = village.builders.map((b) =>
      b.id === 1
        ? { ...b, assignedTo: 'some_building', timeRemaining: 60000 }
        : b,
    );
    useGameStore.getState().setVillageState({ ...village, builders: updatedBuilders });

    useGameStore.getState().tick(10000);

    const builder = useGameStore.getState().village.builders.find((b) => b.id === 1);
    // gameClockSpeed is 1, so 10000ms delta reduces timeRemaining by 10000
    expect(builder!.timeRemaining).toBe(50000);
  });

  it('does not go below 0 for builder timeRemaining', () => {
    const village = useGameStore.getState().village;
    const updatedBuilders = village.builders.map((b) =>
      b.id === 1
        ? { ...b, assignedTo: 'some_building', timeRemaining: 5000 }
        : b,
    );
    useGameStore.getState().setVillageState({ ...village, builders: updatedBuilders });

    // Tick for way longer than the remaining time
    useGameStore.getState().tick(100000);

    const builder = useGameStore.getState().village.builders.find((b) => b.id === 1);
    expect(builder!.timeRemaining).toBe(0);
  });

  it('does not modify idle builders', () => {
    // Builder 1 should be idle by default
    const builderBefore = useGameStore.getState().village.builders.find((b) => b.id === 1);
    expect(builderBefore!.assignedTo).toBeNull();

    useGameStore.getState().tick(10000);

    const builderAfter = useGameStore.getState().village.builders.find((b) => b.id === 1);
    expect(builderAfter!.timeRemaining).toBe(0);
    expect(builderAfter!.assignedTo).toBeNull();
  });

  it('decrements building upgradeTimeRemaining in sync', () => {
    const village = useGameStore.getState().village;
    const firstBuilding = village.buildings[0]!;

    const updatedBuildings = village.buildings.map((b) =>
      b.instanceId === firstBuilding.instanceId
        ? { ...b, isUpgrading: true, upgradeTimeRemaining: 60000, assignedBuilder: 1 }
        : b,
    );
    const updatedBuilders = village.builders.map((b) =>
      b.id === 1
        ? { ...b, assignedTo: firstBuilding.instanceId, timeRemaining: 60000 }
        : b,
    );
    useGameStore.getState().setVillageState({
      ...village,
      buildings: updatedBuildings,
      builders: updatedBuilders,
    });

    useGameStore.getState().tick(20000);

    const building = useGameStore.getState().village.buildings.find(
      (b) => b.instanceId === firstBuilding.instanceId,
    );
    expect(building!.upgradeTimeRemaining).toBe(40000);
  });
});

// ---------------------------------------------------------------------------
// tick - super troop timers
// ---------------------------------------------------------------------------

describe('tick - super troop timers', () => {
  it('decrements super troop boost timer', () => {
    const boost: SuperTroopBoost = {
      baseTroopName: 'Barbarian',
      superTroopName: 'Super Barbarian',
      remainingDurationMs: 100_000,
    };
    useGameStore.setState({ superTroopState: { activeBoosts: [boost] } });

    useGameStore.getState().tick(30_000);

    const { superTroopState } = useGameStore.getState();
    expect(superTroopState.activeBoosts.length).toBe(1);
    expect(superTroopState.activeBoosts[0]!.remainingDurationMs).toBe(70_000);
  });

  it('removes expired super troop boosts', () => {
    const boost: SuperTroopBoost = {
      baseTroopName: 'Barbarian',
      superTroopName: 'Super Barbarian',
      remainingDurationMs: 10_000,
    };
    useGameStore.setState({ superTroopState: { activeBoosts: [boost] } });

    // Tick past the boost duration
    useGameStore.getState().tick(20_000);

    const { superTroopState } = useGameStore.getState();
    expect(superTroopState.activeBoosts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// startUpgrade / completeUpgrade
// ---------------------------------------------------------------------------

describe('startUpgrade', () => {
  it('returns false when insufficient resources', () => {
    const village = useGameStore.getState().village;
    const firstBuilding = village.buildings[0]!;

    // Try to start an upgrade that costs way more than we have
    const result = useGameStore.getState().startUpgrade(
      firstBuilding.instanceId,
      999_999,
      'gold',
      60000,
    );

    expect(result).toBe(false);
  });

  it('returns false when no builders are available', () => {
    // Assign all unlocked builders
    const village = useGameStore.getState().village;
    const updatedBuilders = village.builders.map((b) =>
      b.isUnlocked ? { ...b, assignedTo: 'occupied', timeRemaining: 60000 } : b,
    );
    useGameStore.getState().setVillageState({ ...village, builders: updatedBuilders });

    const firstBuilding = useGameStore.getState().village.buildings[0]!;
    const result = useGameStore.getState().startUpgrade(
      firstBuilding.instanceId,
      10,
      'gold',
      60000,
    );

    expect(result).toBe(false);
  });

  it('deducts resources and assigns builder on success', () => {
    const goldBefore = useGameStore.getState().village.resources.gold;
    const firstBuilding = useGameStore.getState().village.buildings[0]!;
    const cost = 100;

    const result = useGameStore.getState().startUpgrade(
      firstBuilding.instanceId,
      cost,
      'gold',
      60000,
    );

    expect(result).toBe(true);
    expect(useGameStore.getState().village.resources.gold).toBe(goldBefore - cost);

    const building = useGameStore.getState().village.buildings.find(
      (b) => b.instanceId === firstBuilding.instanceId,
    );
    expect(building!.isUpgrading).toBe(true);
    expect(building!.upgradeTimeRemaining).toBe(60000);
    expect(building!.assignedBuilder).not.toBeNull();
  });
});

describe('completeUpgrade', () => {
  it('increments building level and clears upgrade state', () => {
    const village = useGameStore.getState().village;
    const firstBuilding = village.buildings[0]!;
    const levelBefore = firstBuilding.level;

    // Set up the building as upgrading with a builder assigned
    const updatedBuildings = village.buildings.map((b) =>
      b.instanceId === firstBuilding.instanceId
        ? { ...b, isUpgrading: true, upgradeTimeRemaining: 1000, assignedBuilder: 1 }
        : b,
    );
    const updatedBuilders = village.builders.map((b) =>
      b.id === 1
        ? { ...b, assignedTo: firstBuilding.instanceId, timeRemaining: 1000 }
        : b,
    );
    useGameStore.getState().setVillageState({
      ...village,
      buildings: updatedBuildings,
      builders: updatedBuilders,
    });

    useGameStore.getState().completeUpgrade(firstBuilding.instanceId);

    const building = useGameStore.getState().village.buildings.find(
      (b) => b.instanceId === firstBuilding.instanceId,
    );
    expect(building!.level).toBe(levelBefore + 1);
    expect(building!.isUpgrading).toBe(false);
    expect(building!.upgradeTimeRemaining).toBe(0);
    expect(building!.assignedBuilder).toBeNull();
  });

  it('frees the assigned builder', () => {
    const village = useGameStore.getState().village;
    const firstBuilding = village.buildings[0]!;

    const updatedBuildings = village.buildings.map((b) =>
      b.instanceId === firstBuilding.instanceId
        ? { ...b, isUpgrading: true, upgradeTimeRemaining: 1000, assignedBuilder: 1 }
        : b,
    );
    const updatedBuilders = village.builders.map((b) =>
      b.id === 1
        ? { ...b, assignedTo: firstBuilding.instanceId, timeRemaining: 1000 }
        : b,
    );
    useGameStore.getState().setVillageState({
      ...village,
      buildings: updatedBuildings,
      builders: updatedBuilders,
    });

    useGameStore.getState().completeUpgrade(firstBuilding.instanceId);

    const builder = useGameStore.getState().village.builders.find((b) => b.id === 1);
    expect(builder!.assignedTo).toBeNull();
    expect(builder!.timeRemaining).toBe(0);
  });

  it('is a no-op for a building that is not upgrading', () => {
    const village = useGameStore.getState().village;
    const firstBuilding = village.buildings[0]!;
    const levelBefore = firstBuilding.level;

    useGameStore.getState().completeUpgrade(firstBuilding.instanceId);

    const building = useGameStore.getState().village.buildings.find(
      (b) => b.instanceId === firstBuilding.instanceId,
    );
    expect(building!.level).toBe(levelBefore);
  });

  it('recomputes storage caps after completing an upgrade', () => {
    const village = useGameStore.getState().village;
    const storageBuilding = village.buildings.find(
      (b) => b.buildingType === 'resource_storage',
    );
    expect(storageBuilding).toBeDefined();

    // Set storage building as upgrading
    const updatedBuildings = village.buildings.map((b) =>
      b.instanceId === storageBuilding!.instanceId
        ? { ...b, isUpgrading: true, upgradeTimeRemaining: 1000, assignedBuilder: 1 }
        : b,
    );
    const updatedBuilders = village.builders.map((b) =>
      b.id === 1
        ? { ...b, assignedTo: storageBuilding!.instanceId, timeRemaining: 1000 }
        : b,
    );
    useGameStore.getState().setVillageState({
      ...village,
      buildings: updatedBuildings,
      builders: updatedBuilders,
    });

    const capsBefore = { ...useGameStore.getState().storageCaps };

    useGameStore.getState().completeUpgrade(storageBuilding!.instanceId);

    const capsAfter = useGameStore.getState().storageCaps;
    // After leveling up a storage, gold cap should increase (or at least be recomputed)
    expect(capsAfter.gold).toBeGreaterThanOrEqual(capsBefore.gold);
  });
});

// ---------------------------------------------------------------------------
// collectResource / collectAll
// ---------------------------------------------------------------------------

describe('collectResource', () => {
  it('transfers uncollected resources from a collector to the village pool', () => {
    // Tick so the Gold Mine accumulates some resources
    useGameStore.getState().tick(3_600_000);

    const goldMine = useGameStore.getState().village.buildings.find(
      (b) => b.buildingId === 'Gold Mine',
    );
    expect(goldMine).toBeDefined();
    const uncollected = goldMine!.uncollectedResources ?? 0;
    expect(uncollected).toBeGreaterThan(0);

    const goldBefore = useGameStore.getState().village.resources.gold;
    useGameStore.getState().collectResource(goldMine!.instanceId);

    const goldAfter = useGameStore.getState().village.resources.gold;
    expect(goldAfter).toBeGreaterThan(goldBefore);

    // The collector should be emptied after collection
    const goldMineAfter = useGameStore.getState().village.buildings.find(
      (b) => b.buildingId === 'Gold Mine',
    );
    expect(goldMineAfter!.uncollectedResources).toBe(0);
  });
});

describe('collectAll', () => {
  it('collects from all resource collectors at once', () => {
    // Tick to produce resources
    useGameStore.getState().tick(3_600_000);

    const goldBefore = useGameStore.getState().village.resources.gold;
    const elixirBefore = useGameStore.getState().village.resources.elixir;

    useGameStore.getState().collectAll();

    const goldAfter = useGameStore.getState().village.resources.gold;
    const elixirAfter = useGameStore.getState().village.resources.elixir;

    // Both should increase since we have Gold Mine and Elixir Collector
    expect(goldAfter).toBeGreaterThan(goldBefore);
    expect(elixirAfter).toBeGreaterThan(elixirBefore);
  });
});

// ---------------------------------------------------------------------------
// setArmy / setSpells
// ---------------------------------------------------------------------------

describe('setArmy', () => {
  it('sets the army composition', () => {
    const army: TrainedTroop[] = [
      { name: 'Barbarian', level: 1, count: 10 },
      { name: 'Archer', level: 1, count: 10 },
    ];

    useGameStore.getState().setArmy(army);

    expect(useGameStore.getState().village.army).toEqual(army);
  });

  it('replaces existing army with new composition', () => {
    const armyA: TrainedTroop[] = [{ name: 'Barbarian', level: 1, count: 20 }];
    const armyB: TrainedTroop[] = [{ name: 'Giant', level: 2, count: 5 }];

    useGameStore.getState().setArmy(armyA);
    expect(useGameStore.getState().village.army).toEqual(armyA);

    useGameStore.getState().setArmy(armyB);
    expect(useGameStore.getState().village.army).toEqual(armyB);
  });

  it('can set an empty army', () => {
    useGameStore.getState().setArmy([{ name: 'Barbarian', level: 1, count: 5 }]);
    useGameStore.getState().setArmy([]);

    expect(useGameStore.getState().village.army).toEqual([]);
  });
});

describe('setSpells', () => {
  it('sets the spell composition', () => {
    const spells: TrainedTroop[] = [
      { name: 'Lightning Spell', level: 1, count: 2 },
    ];

    useGameStore.getState().setSpells(spells);

    expect(useGameStore.getState().village.spells).toEqual(spells);
  });

  it('replaces existing spells', () => {
    useGameStore.getState().setSpells([{ name: 'Healing Spell', level: 1, count: 1 }]);
    useGameStore.getState().setSpells([{ name: 'Rage Spell', level: 3, count: 3 }]);

    expect(useGameStore.getState().village.spells).toEqual([
      { name: 'Rage Spell', level: 3, count: 3 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// setTrophies / setLeague
// ---------------------------------------------------------------------------

describe('setTrophies', () => {
  it('updates the trophy count', () => {
    useGameStore.getState().setTrophies(1500);
    expect(useGameStore.getState().village.trophies).toBe(1500);
  });

  it('can set trophies to zero', () => {
    useGameStore.getState().setTrophies(1000);
    useGameStore.getState().setTrophies(0);
    expect(useGameStore.getState().village.trophies).toBe(0);
  });
});

describe('setLeague', () => {
  it('updates the league name', () => {
    useGameStore.getState().setLeague('Champion I');
    expect(useGameStore.getState().village.league).toBe('Champion I');
  });

  it('can change between leagues', () => {
    useGameStore.getState().setLeague('Silver II');
    expect(useGameStore.getState().village.league).toBe('Silver II');

    useGameStore.getState().setLeague('Gold III');
    expect(useGameStore.getState().village.league).toBe('Gold III');
  });
});

// ---------------------------------------------------------------------------
// setSuperTroopState / setInventory
// ---------------------------------------------------------------------------

describe('setSuperTroopState', () => {
  it('replaces the super troop state', () => {
    const newState: SuperTroopState = {
      activeBoosts: [
        { baseTroopName: 'Archer', superTroopName: 'Super Archer', remainingDurationMs: 50_000 },
      ],
    };

    useGameStore.getState().setSuperTroopState(newState);

    expect(useGameStore.getState().superTroopState).toEqual(newState);
  });
});

describe('setInventory', () => {
  it('replaces the magic item inventory', () => {
    const newInventory: MagicItemInventory = {
      items: { book_building: 1, wall_ring: 5 },
    };

    useGameStore.getState().setInventory(newInventory);

    expect(useGameStore.getState().inventory).toEqual(newInventory);
  });

  it('can clear the inventory', () => {
    useGameStore.getState().setInventory({ items: { rune_gold: 1 } });
    useGameStore.getState().setInventory({ items: {} });

    expect(useGameStore.getState().inventory.items).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// save / load (localStorage round-trip)
// ---------------------------------------------------------------------------

describe('save and load', () => {
  it('saves the current village and loads it back', () => {
    useGameStore.getState().setTrophies(1234);
    const villageBefore = useGameStore.getState().village;

    const saveResult = useGameStore.getState().save('test_slot');
    expect(saveResult).toBe(true);

    // Mutate the store
    useGameStore.getState().setTrophies(9999);
    expect(useGameStore.getState().village.trophies).toBe(9999);

    // Load the saved state
    const loadResult = useGameStore.getState().load('test_slot');
    expect(loadResult).toBe(true);
    expect(useGameStore.getState().village.trophies).toBe(1234);
  });

  it('uses default slot "slot1" when no slotId is provided', () => {
    useGameStore.getState().setTrophies(777);
    useGameStore.getState().save();

    useGameStore.getState().setTrophies(0);
    const loaded = useGameStore.getState().load('slot1');

    expect(loaded).toBe(true);
    expect(useGameStore.getState().village.trophies).toBe(777);
  });

  it('returns false when loading a non-existent slot', () => {
    const result = useGameStore.getState().load('nonexistent');
    expect(result).toBe(false);
  });

  it('saves and loads village resources correctly', () => {
    useGameStore.getState().addResources({ gold: 1000, elixir: 2000 });
    const resourcesBefore = { ...useGameStore.getState().village.resources };

    useGameStore.getState().save('res_slot');

    // Change resources
    useGameStore.getState().spendResources({ gold: 500 });

    useGameStore.getState().load('res_slot');
    const resourcesAfter = useGameStore.getState().village.resources;

    expect(resourcesAfter.gold).toBe(resourcesBefore.gold);
    expect(resourcesAfter.elixir).toBe(resourcesBefore.elixir);
  });

  it('recomputes storage caps after loading', () => {
    useGameStore.getState().save('caps_slot');
    useGameStore.getState().load('caps_slot');

    const caps = useGameStore.getState().storageCaps;
    expect(caps.gold).toBeGreaterThan(0);
    expect(caps.elixir).toBeGreaterThan(0);
  });

  it('handles multiple save slots independently', () => {
    useGameStore.getState().setTrophies(100);
    useGameStore.getState().save('slotA');

    useGameStore.getState().setTrophies(200);
    useGameStore.getState().save('slotB');

    useGameStore.getState().load('slotA');
    expect(useGameStore.getState().village.trophies).toBe(100);

    useGameStore.getState().load('slotB');
    expect(useGameStore.getState().village.trophies).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// enableAutoSave / disableAutoSave
// ---------------------------------------------------------------------------

describe('auto-save', () => {
  it('enableAutoSave sets up periodic saving', () => {
    vi.useFakeTimers();

    useGameStore.getState().setTrophies(555);
    useGameStore.getState().enableAutoSave(1000);

    // Advance past the auto-save interval
    vi.advanceTimersByTime(1500);

    // The auto-save should have saved to the "autosave" slot
    const saved = localStorage.getItem('coc_save_autosave');
    expect(saved).not.toBeNull();

    const parsed = JSON.parse(saved!) as VillageState;
    expect(parsed.trophies).toBe(555);

    useGameStore.getState().disableAutoSave();
    vi.useRealTimers();
  });

  it('disableAutoSave stops periodic saving', () => {
    vi.useFakeTimers();

    useGameStore.getState().enableAutoSave(1000);
    useGameStore.getState().disableAutoSave();

    // Advance time; no save should be triggered
    vi.advanceTimersByTime(5000);

    const saved = localStorage.getItem('coc_save_autosave');
    expect(saved).toBeNull();

    vi.useRealTimers();
  });
});
