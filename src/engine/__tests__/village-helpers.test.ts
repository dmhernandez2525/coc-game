import {
  resetInstanceCounter,
  generateInstanceId,
  createBuilderSlots,
  makePlacedBuilding,
  getUpgradeCost,
  deductResources,
  countBuildings,
  getMaxCountForTH,
} from '../village-helpers.ts';
import type { PlacedBuilding, ResourceAmounts } from '../../types/village.ts';

// ---------------------------------------------------------------------------
// Instance ID generation
// ---------------------------------------------------------------------------

describe('generateInstanceId + resetInstanceCounter', () => {
  beforeEach(() => {
    resetInstanceCounter();
  });

  it('generates sequential IDs starting from bld_1', () => {
    expect(generateInstanceId()).toBe('bld_1');
    expect(generateInstanceId()).toBe('bld_2');
    expect(generateInstanceId()).toBe('bld_3');
  });

  it('resetInstanceCounter restores counter to 1', () => {
    generateInstanceId(); // bld_1
    generateInstanceId(); // bld_2
    resetInstanceCounter();
    expect(generateInstanceId()).toBe('bld_1');
  });

  it('resetInstanceCounter accepts a custom start value', () => {
    resetInstanceCounter(50);
    expect(generateInstanceId()).toBe('bld_50');
    expect(generateInstanceId()).toBe('bld_51');
  });
});

// ---------------------------------------------------------------------------
// Builder slots
// ---------------------------------------------------------------------------

describe('createBuilderSlots', () => {
  it('creates exactly 5 builder slots', () => {
    const slots = createBuilderSlots();
    expect(slots).toHaveLength(5);
  });

  it('only the first builder (id 1) is unlocked', () => {
    const slots = createBuilderSlots();
    const unlocked = slots.filter((s) => s.isUnlocked);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0]!.id).toBe(1);
  });

  it('all builders start idle with no assignment', () => {
    const slots = createBuilderSlots();
    for (const slot of slots) {
      expect(slot.assignedTo).toBeNull();
      expect(slot.timeRemaining).toBe(0);
    }
  });

  it('builder ids range from 1 to 5', () => {
    const slots = createBuilderSlots();
    const ids = slots.map((s) => s.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// makePlacedBuilding
// ---------------------------------------------------------------------------

describe('makePlacedBuilding', () => {
  beforeEach(() => {
    resetInstanceCounter();
  });

  it('creates a building with the correct fields and level 1', () => {
    const b = makePlacedBuilding('Cannon', 'defense', 5, 10);
    expect(b.buildingId).toBe('Cannon');
    expect(b.buildingType).toBe('defense');
    expect(b.level).toBe(1);
    expect(b.gridX).toBe(5);
    expect(b.gridY).toBe(10);
  });

  it('building is not upgrading and has no assigned builder', () => {
    const b = makePlacedBuilding('Gold Mine', 'resource_collector', 0, 0);
    expect(b.isUpgrading).toBe(false);
    expect(b.upgradeTimeRemaining).toBe(0);
    expect(b.assignedBuilder).toBeNull();
  });

  it('uses generateInstanceId for instanceId', () => {
    const b1 = makePlacedBuilding('Cannon', 'defense', 0, 0);
    const b2 = makePlacedBuilding('Cannon', 'defense', 1, 1);
    expect(b1.instanceId).toBe('bld_1');
    expect(b2.instanceId).toBe('bld_2');
  });
});

// ---------------------------------------------------------------------------
// getUpgradeCost
// ---------------------------------------------------------------------------

describe('getUpgradeCost', () => {
  it('returns cost info for Cannon level 1', () => {
    const info = getUpgradeCost('Cannon', 1);
    expect(info).toBeDefined();
    expect(info!.cost).toBe(250);
    expect(info!.resource).toBe('Gold');
    expect(info!.time).toBe(10);
  });

  it('returns cost info for Town Hall level 1', () => {
    const info = getUpgradeCost('Town Hall', 1);
    expect(info).toBeDefined();
    expect(info!.cost).toBe(0);
    expect(info!.resource).toBe('Gold');
    expect(info!.time).toBe(0);
  });

  it('returns cost info for a resource building (Gold Mine level 1)', () => {
    const info = getUpgradeCost('Gold Mine', 1);
    expect(info).toBeDefined();
    expect(info!.cost).toBe(150);
    expect(info!.resource).toBe('Elixir');
    expect(info!.time).toBe(5);
  });

  it('returns cost info for an army building (Barracks level 1)', () => {
    const info = getUpgradeCost('Barracks', 1);
    expect(info).toBeDefined();
    expect(info!.cost).toBe(100);
    expect(info!.resource).toBe('Elixir');
    expect(info!.time).toBe(10);
  });

  it('returns undefined for an unknown building', () => {
    expect(getUpgradeCost('NonexistentBuilding', 1)).toBeUndefined();
  });

  it('returns undefined for a level beyond max', () => {
    expect(getUpgradeCost('Cannon', 9999)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deductResources
// ---------------------------------------------------------------------------

describe('deductResources', () => {
  const baseResources: ResourceAmounts = {
    gold: 5000,
    elixir: 3000,
    darkElixir: 100,
    gems: 50,
  };

  it('deducts Gold correctly', () => {
    const result = deductResources(baseResources, 2000, 'Gold');
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(3000);
    // Other resources remain unchanged
    expect(result!.elixir).toBe(3000);
    expect(result!.darkElixir).toBe(100);
    expect(result!.gems).toBe(50);
  });

  it('deducts Elixir correctly', () => {
    const result = deductResources(baseResources, 1500, 'Elixir');
    expect(result).not.toBeNull();
    expect(result!.elixir).toBe(1500);
    expect(result!.gold).toBe(5000);
  });

  it('deducts Dark Elixir correctly', () => {
    const result = deductResources(baseResources, 75, 'Dark Elixir');
    expect(result).not.toBeNull();
    expect(result!.darkElixir).toBe(25);
    expect(result!.gold).toBe(5000);
  });

  it('returns null when player cannot afford the cost', () => {
    const result = deductResources(baseResources, 10000, 'Gold');
    expect(result).toBeNull();
  });

  it('"Gold or Elixir" tries gold first when both are sufficient', () => {
    const result = deductResources(baseResources, 2000, 'Gold or Elixir');
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(3000);
    // Elixir should be untouched since gold was sufficient
    expect(result!.elixir).toBe(3000);
  });

  it('"Gold or Elixir" falls back to elixir when gold is insufficient', () => {
    const lowGold: ResourceAmounts = {
      gold: 100,
      elixir: 5000,
      darkElixir: 0,
      gems: 0,
    };
    const result = deductResources(lowGold, 2000, 'Gold or Elixir');
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(100); // unchanged
    expect(result!.elixir).toBe(3000);
  });

  it('"Gold or Elixir" returns null when neither resource is sufficient', () => {
    const broke: ResourceAmounts = {
      gold: 10,
      elixir: 10,
      darkElixir: 0,
      gems: 0,
    };
    const result = deductResources(broke, 500, 'Gold or Elixir');
    expect(result).toBeNull();
  });

  it('returns null for an unknown resource type', () => {
    const result = deductResources(
      baseResources,
      100,
      'Gems' as unknown as 'Gold',
    );
    expect(result).toBeNull();
  });

  it('does not mutate the original resources object', () => {
    const original: ResourceAmounts = { gold: 1000, elixir: 1000, darkElixir: 0, gems: 0 };
    const frozen = { ...original };
    deductResources(original, 500, 'Gold');
    expect(original).toEqual(frozen);
  });
});

// ---------------------------------------------------------------------------
// countBuildings
// ---------------------------------------------------------------------------

describe('countBuildings', () => {
  beforeEach(() => {
    resetInstanceCounter();
  });

  it('counts buildings with the matching buildingId', () => {
    const buildings: PlacedBuilding[] = [
      makePlacedBuilding('Cannon', 'defense', 0, 0),
      makePlacedBuilding('Cannon', 'defense', 3, 0),
      makePlacedBuilding('Archer Tower', 'defense', 6, 0),
    ];
    expect(countBuildings(buildings, 'Cannon')).toBe(2);
    expect(countBuildings(buildings, 'Archer Tower')).toBe(1);
  });

  it('returns 0 when no buildings match', () => {
    const buildings: PlacedBuilding[] = [
      makePlacedBuilding('Cannon', 'defense', 0, 0),
    ];
    expect(countBuildings(buildings, 'Wizard Tower')).toBe(0);
  });

  it('returns 0 for an empty array', () => {
    expect(countBuildings([], 'Cannon')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMaxCountForTH
// ---------------------------------------------------------------------------

describe('getMaxCountForTH', () => {
  it('returns the correct count for Cannon at TH1 from buildingCounts', () => {
    // TH1 buildingCounts lists Cannon: 2
    expect(getMaxCountForTH('Cannon', 1)).toBe(2);
  });

  it('returns 0 for a completely unknown building', () => {
    expect(getMaxCountForTH('MadeUpBuilding', 1)).toBe(0);
  });

  it('returns the correct count for Gold Mine at TH1', () => {
    // TH1 buildingCounts lists Gold Mine: 1
    expect(getMaxCountForTH('Gold Mine', 1)).toBe(1);
  });

  it('returns 0 for a building not available at that TH level', () => {
    // Laboratory is 0 at TH1 per the buildingCounts
    expect(getMaxCountForTH('Laboratory', 1)).toBe(0);
  });
});
