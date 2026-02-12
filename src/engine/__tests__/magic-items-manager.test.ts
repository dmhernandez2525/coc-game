import type { VillageState } from '../../types/village.ts';
import type { MagicItemInventory } from '../magic-items-manager.ts';
import {
  createInventory,
  getAllMagicItems,
  getMagicItem,
  getItemCount,
  addItem,
  removeItem,
  useBookOfBuilding,
  useRune,
  useWallRing,
  getInventoryContents,
} from '../magic-items-manager.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVillage(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 8,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 50000, elixir: 50000, darkElixir: 1000, gems: 500 },
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

function makeInventoryWith(items: Record<string, number>): MagicItemInventory {
  return { items };
}

// ===========================================================================
// createInventory
// ===========================================================================
describe('createInventory', () => {
  it('returns an inventory with an empty items record', () => {
    const inv = createInventory();

    expect(inv).toEqual({ items: {} });
  });

  it('returns a new object each time it is called', () => {
    const a = createInventory();
    const b = createInventory();

    expect(a).not.toBe(b);
  });
});

// ===========================================================================
// getAllMagicItems
// ===========================================================================
describe('getAllMagicItems', () => {
  it('returns a non-empty array of magic item definitions', () => {
    const items = getAllMagicItems();

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it('includes items of every type (book, potion, rune, wall_ring)', () => {
    const items = getAllMagicItems();
    const types = new Set(items.map((i) => i.type));

    expect(types.has('book')).toBe(true);
    expect(types.has('potion')).toBe(true);
    expect(types.has('rune')).toBe(true);
    expect(types.has('wall_ring')).toBe(true);
  });

  it('returns a defensive copy (modifying the array does not affect future calls)', () => {
    const first = getAllMagicItems();
    first.pop();
    const second = getAllMagicItems();

    expect(second.length).toBeGreaterThan(first.length);
  });
});

// ===========================================================================
// getMagicItem
// ===========================================================================
describe('getMagicItem', () => {
  it('returns the correct item definition for a known ID', () => {
    const item = getMagicItem('book_building');

    expect(item).toBeDefined();
    expect(item!.id).toBe('book_building');
    expect(item!.name).toBe('Book of Building');
    expect(item!.type).toBe('book');
  });

  it('returns undefined for an unknown ID', () => {
    const item = getMagicItem('nonexistent_item');

    expect(item).toBeUndefined();
  });

  it('returns the wall_ring item with correct maxStack of 25', () => {
    const item = getMagicItem('wall_ring');

    expect(item).toBeDefined();
    expect(item!.maxStack).toBe(25);
  });
});

// ===========================================================================
// getItemCount
// ===========================================================================
describe('getItemCount', () => {
  it('returns 0 for an empty inventory', () => {
    const inv = createInventory();

    expect(getItemCount(inv, 'book_building')).toBe(0);
  });

  it('returns the correct count when the item exists in inventory', () => {
    const inv = makeInventoryWith({ wall_ring: 10, builder_potion: 3 });

    expect(getItemCount(inv, 'wall_ring')).toBe(10);
    expect(getItemCount(inv, 'builder_potion')).toBe(3);
  });

  it('returns 0 for an item not present in a non-empty inventory', () => {
    const inv = makeInventoryWith({ wall_ring: 5 });

    expect(getItemCount(inv, 'rune_gold')).toBe(0);
  });
});

// ===========================================================================
// addItem
// ===========================================================================
describe('addItem', () => {
  it('adds an item to an empty inventory', () => {
    const inv = createInventory();
    const result = addItem(inv, 'wall_ring');

    expect(result).not.toBeNull();
    expect(result!.items['wall_ring']).toBe(1);
  });

  it('increments the count when the item already exists', () => {
    const inv = makeInventoryWith({ wall_ring: 5 });
    const result = addItem(inv, 'wall_ring');

    expect(result).not.toBeNull();
    expect(result!.items['wall_ring']).toBe(6);
  });

  it('returns null when the item is at max stack (maxStack: 1)', () => {
    const inv = makeInventoryWith({ book_building: 1 });
    const result = addItem(inv, 'book_building');

    expect(result).toBeNull();
  });

  it('returns null when the item is at max stack (maxStack: 25)', () => {
    const inv = makeInventoryWith({ wall_ring: 25 });
    const result = addItem(inv, 'wall_ring');

    expect(result).toBeNull();
  });

  it('returns null for an unknown item ID', () => {
    const inv = createInventory();
    const result = addItem(inv, 'totally_fake_item');

    expect(result).toBeNull();
  });

  it('allows adding up to maxStack for potions (maxStack: 5)', () => {
    let inv: MagicItemInventory = createInventory();
    for (let i = 0; i < 5; i++) {
      const next = addItem(inv, 'builder_potion');
      expect(next).not.toBeNull();
      inv = next!;
    }
    expect(inv.items['builder_potion']).toBe(5);

    // The sixth addition should fail
    const overflow = addItem(inv, 'builder_potion');
    expect(overflow).toBeNull();
  });

  it('does not mutate the original inventory', () => {
    const inv = makeInventoryWith({ wall_ring: 3 });
    addItem(inv, 'wall_ring');

    expect(inv.items['wall_ring']).toBe(3);
  });
});

// ===========================================================================
// removeItem
// ===========================================================================
describe('removeItem', () => {
  it('decrements the count of an item with count > 1', () => {
    const inv = makeInventoryWith({ wall_ring: 10 });
    const result = removeItem(inv, 'wall_ring');

    expect(result).not.toBeNull();
    expect(result!.items['wall_ring']).toBe(9);
  });

  it('removes the key entirely when count reaches 0', () => {
    const inv = makeInventoryWith({ book_building: 1 });
    const result = removeItem(inv, 'book_building');

    expect(result).not.toBeNull();
    expect('book_building' in result!.items).toBe(false);
  });

  it('returns null when the item count is 0', () => {
    const inv = createInventory();
    const result = removeItem(inv, 'wall_ring');

    expect(result).toBeNull();
  });

  it('returns null when the item does not exist in inventory', () => {
    const inv = makeInventoryWith({ rune_gold: 1 });
    const result = removeItem(inv, 'book_building');

    expect(result).toBeNull();
  });

  it('does not mutate the original inventory', () => {
    const inv = makeInventoryWith({ wall_ring: 5 });
    removeItem(inv, 'wall_ring');

    expect(inv.items['wall_ring']).toBe(5);
  });

  it('preserves other items when one is removed', () => {
    const inv = makeInventoryWith({ wall_ring: 3, rune_gold: 1 });
    const result = removeItem(inv, 'rune_gold');

    expect(result).not.toBeNull();
    expect(result!.items['wall_ring']).toBe(3);
    expect('rune_gold' in result!.items).toBe(false);
  });
});

// ===========================================================================
// useBookOfBuilding
// ===========================================================================
describe('useBookOfBuilding', () => {
  it('completes a building upgrade and frees the assigned builder', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: true,
          upgradeTimeRemaining: 3600,
          assignedBuilder: 1,
        },
      ],
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'cannon-1', timeRemaining: 3600 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const inv = makeInventoryWith({ book_building: 1 });

    const result = useBookOfBuilding(state, inv, 'cannon-1');

    expect(result).not.toBeNull();

    const building = result!.state.buildings.find((b) => b.instanceId === 'cannon-1');
    expect(building!.level).toBe(4);
    expect(building!.isUpgrading).toBe(false);
    expect(building!.upgradeTimeRemaining).toBe(0);
    expect(building!.assignedBuilder).toBeNull();

    const builder = result!.state.builders.find((b) => b.id === 1);
    expect(builder!.assignedTo).toBeNull();
    expect(builder!.timeRemaining).toBe(0);
  });

  it('consumes the book from inventory after use', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: true,
          upgradeTimeRemaining: 3600,
          assignedBuilder: 1,
        },
      ],
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'cannon-1', timeRemaining: 3600 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const inv = makeInventoryWith({ book_building: 1 });

    const result = useBookOfBuilding(state, inv, 'cannon-1');

    expect(result).not.toBeNull();
    expect(getItemCount(result!.inventory, 'book_building')).toBe(0);
  });

  it('returns null if no book_building in inventory', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: true,
          upgradeTimeRemaining: 3600,
          assignedBuilder: 1,
        },
      ],
    });
    const inv = createInventory();

    const result = useBookOfBuilding(state, inv, 'cannon-1');

    expect(result).toBeNull();
  });

  it('returns null if the building is not upgrading', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: false,
          upgradeTimeRemaining: 0,
          assignedBuilder: null,
        },
      ],
    });
    const inv = makeInventoryWith({ book_building: 1 });

    const result = useBookOfBuilding(state, inv, 'cannon-1');

    expect(result).toBeNull();
  });

  it('returns null if the building instanceId does not exist', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: true,
          upgradeTimeRemaining: 3600,
          assignedBuilder: 1,
        },
      ],
    });
    const inv = makeInventoryWith({ book_building: 1 });

    const result = useBookOfBuilding(state, inv, 'nonexistent-building');

    expect(result).toBeNull();
  });

  it('does not affect other buildings or builders', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: true,
          upgradeTimeRemaining: 3600,
          assignedBuilder: 1,
        },
        {
          instanceId: 'archer-tower-1',
          buildingId: 'archer_tower',
          buildingType: 'defense',
          level: 5,
          gridX: 10,
          gridY: 10,
          isUpgrading: true,
          upgradeTimeRemaining: 7200,
          assignedBuilder: 2,
        },
      ],
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'cannon-1', timeRemaining: 3600 },
        { id: 2, isUnlocked: true, assignedTo: 'archer-tower-1', timeRemaining: 7200 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const inv = makeInventoryWith({ book_building: 1 });

    const result = useBookOfBuilding(state, inv, 'cannon-1');

    expect(result).not.toBeNull();

    const otherBuilding = result!.state.buildings.find((b) => b.instanceId === 'archer-tower-1');
    expect(otherBuilding!.level).toBe(5);
    expect(otherBuilding!.isUpgrading).toBe(true);
    expect(otherBuilding!.upgradeTimeRemaining).toBe(7200);

    const otherBuilder = result!.state.builders.find((b) => b.id === 2);
    expect(otherBuilder!.assignedTo).toBe('archer-tower-1');
    expect(otherBuilder!.timeRemaining).toBe(7200);
  });

  it('does not mutate the original state or inventory', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: true,
          upgradeTimeRemaining: 3600,
          assignedBuilder: 1,
        },
      ],
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'cannon-1', timeRemaining: 3600 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const inv = makeInventoryWith({ book_building: 1 });

    useBookOfBuilding(state, inv, 'cannon-1');

    // Original state unchanged
    expect(state.buildings[0]!.level).toBe(3);
    expect(state.buildings[0]!.isUpgrading).toBe(true);
    expect(state.builders[0]!.assignedTo).toBe('cannon-1');

    // Original inventory unchanged
    expect(inv.items['book_building']).toBe(1);
  });
});

// ===========================================================================
// useRune
// ===========================================================================
describe('useRune', () => {
  it('fills gold to max capacity when using rune_gold', () => {
    const state = makeVillage({
      resources: { gold: 10000, elixir: 50000, darkElixir: 1000, gems: 500 },
    });
    const inv = makeInventoryWith({ rune_gold: 1 });

    const result = useRune(state, inv, 'rune_gold', 500000);

    expect(result).not.toBeNull();
    expect(result!.state.resources.gold).toBe(500000);
    expect(result!.state.resources.elixir).toBe(50000);
    expect(result!.state.resources.darkElixir).toBe(1000);
  });

  it('fills elixir to max capacity when using rune_elixir', () => {
    const state = makeVillage({
      resources: { gold: 50000, elixir: 200, darkElixir: 1000, gems: 500 },
    });
    const inv = makeInventoryWith({ rune_elixir: 1 });

    const result = useRune(state, inv, 'rune_elixir', 500000);

    expect(result).not.toBeNull();
    expect(result!.state.resources.elixir).toBe(500000);
    expect(result!.state.resources.gold).toBe(50000);
  });

  it('fills dark elixir to max capacity when using rune_dark_elixir', () => {
    const state = makeVillage({
      resources: { gold: 50000, elixir: 50000, darkElixir: 0, gems: 500 },
    });
    const inv = makeInventoryWith({ rune_dark_elixir: 1 });

    const result = useRune(state, inv, 'rune_dark_elixir', 10000);

    expect(result).not.toBeNull();
    expect(result!.state.resources.darkElixir).toBe(10000);
  });

  it('consumes the rune from inventory after use', () => {
    const state = makeVillage();
    const inv = makeInventoryWith({ rune_gold: 1 });

    const result = useRune(state, inv, 'rune_gold', 500000);

    expect(result).not.toBeNull();
    expect(getItemCount(result!.inventory, 'rune_gold')).toBe(0);
  });

  it('returns null if no rune in inventory', () => {
    const state = makeVillage();
    const inv = createInventory();

    const result = useRune(state, inv, 'rune_gold', 500000);

    expect(result).toBeNull();
  });

  it('returns null for an invalid rune ID', () => {
    const state = makeVillage();
    const inv = makeInventoryWith({ wall_ring: 5 });

    const result = useRune(state, inv, 'wall_ring', 500000);

    expect(result).toBeNull();
  });

  it('does not mutate the original state or inventory', () => {
    const state = makeVillage({
      resources: { gold: 10000, elixir: 50000, darkElixir: 1000, gems: 500 },
    });
    const inv = makeInventoryWith({ rune_gold: 1 });

    useRune(state, inv, 'rune_gold', 500000);

    expect(state.resources.gold).toBe(10000);
    expect(inv.items['rune_gold']).toBe(1);
  });
});

// ===========================================================================
// useWallRing
// ===========================================================================
describe('useWallRing', () => {
  it('upgrades the target wall by one level', () => {
    const state = makeVillage({
      walls: [
        { instanceId: 'wall-1', level: 5, gridX: 0, gridY: 0 },
        { instanceId: 'wall-2', level: 3, gridX: 1, gridY: 0 },
      ],
    });
    const inv = makeInventoryWith({ wall_ring: 10 });

    const result = useWallRing(state, inv, 'wall-1');

    expect(result).not.toBeNull();
    const wall = result!.state.walls.find((w) => w.instanceId === 'wall-1');
    expect(wall!.level).toBe(6);
  });

  it('does not affect other walls', () => {
    const state = makeVillage({
      walls: [
        { instanceId: 'wall-1', level: 5, gridX: 0, gridY: 0 },
        { instanceId: 'wall-2', level: 3, gridX: 1, gridY: 0 },
      ],
    });
    const inv = makeInventoryWith({ wall_ring: 10 });

    const result = useWallRing(state, inv, 'wall-1');

    expect(result).not.toBeNull();
    const otherWall = result!.state.walls.find((w) => w.instanceId === 'wall-2');
    expect(otherWall!.level).toBe(3);
  });

  it('consumes one wall ring from inventory', () => {
    const state = makeVillage({
      walls: [{ instanceId: 'wall-1', level: 1, gridX: 0, gridY: 0 }],
    });
    const inv = makeInventoryWith({ wall_ring: 10 });

    const result = useWallRing(state, inv, 'wall-1');

    expect(result).not.toBeNull();
    expect(getItemCount(result!.inventory, 'wall_ring')).toBe(9);
  });

  it('returns null if no wall_ring in inventory', () => {
    const state = makeVillage({
      walls: [{ instanceId: 'wall-1', level: 1, gridX: 0, gridY: 0 }],
    });
    const inv = createInventory();

    const result = useWallRing(state, inv, 'wall-1');

    expect(result).toBeNull();
  });

  it('returns null if the wall instanceId does not exist', () => {
    const state = makeVillage({
      walls: [{ instanceId: 'wall-1', level: 1, gridX: 0, gridY: 0 }],
    });
    const inv = makeInventoryWith({ wall_ring: 5 });

    const result = useWallRing(state, inv, 'nonexistent-wall');

    expect(result).toBeNull();
  });

  it('returns null if the village has no walls', () => {
    const state = makeVillage({ walls: [] });
    const inv = makeInventoryWith({ wall_ring: 5 });

    const result = useWallRing(state, inv, 'wall-1');

    expect(result).toBeNull();
  });

  it('does not mutate the original state or inventory', () => {
    const state = makeVillage({
      walls: [{ instanceId: 'wall-1', level: 5, gridX: 0, gridY: 0 }],
    });
    const inv = makeInventoryWith({ wall_ring: 10 });

    useWallRing(state, inv, 'wall-1');

    expect(state.walls[0]!.level).toBe(5);
    expect(inv.items['wall_ring']).toBe(10);
  });
});

// ===========================================================================
// getInventoryContents
// ===========================================================================
describe('getInventoryContents', () => {
  it('returns an empty array for an empty inventory', () => {
    const inv = createInventory();
    const contents = getInventoryContents(inv);

    expect(contents).toEqual([]);
  });

  it('returns items with their definitions and counts', () => {
    const inv = makeInventoryWith({ wall_ring: 15, rune_gold: 1 });
    const contents = getInventoryContents(inv);

    expect(contents).toHaveLength(2);

    const wallRingEntry = contents.find((c) => c.item.id === 'wall_ring');
    expect(wallRingEntry).toBeDefined();
    expect(wallRingEntry!.count).toBe(15);
    expect(wallRingEntry!.item.name).toBe('Wall Ring');

    const runeEntry = contents.find((c) => c.item.id === 'rune_gold');
    expect(runeEntry).toBeDefined();
    expect(runeEntry!.count).toBe(1);
  });

  it('skips items with a count of zero', () => {
    const inv = makeInventoryWith({ wall_ring: 0, rune_gold: 1 });
    const contents = getInventoryContents(inv);

    expect(contents).toHaveLength(1);
    expect(contents[0]!.item.id).toBe('rune_gold');
  });

  it('skips items with unknown IDs in the inventory record', () => {
    const inv = makeInventoryWith({ totally_unknown: 5, rune_elixir: 1 });
    const contents = getInventoryContents(inv);

    expect(contents).toHaveLength(1);
    expect(contents[0]!.item.id).toBe('rune_elixir');
  });
});

// ===========================================================================
// Immutability
// ===========================================================================
describe('Immutability', () => {
  it('addItem does not modify the original inventory items object', () => {
    const inv = makeInventoryWith({ wall_ring: 3 });
    const originalItems = { ...inv.items };

    addItem(inv, 'wall_ring');

    expect(inv.items).toEqual(originalItems);
  });

  it('removeItem does not modify the original inventory items object', () => {
    const inv = makeInventoryWith({ wall_ring: 3 });
    const originalItems = { ...inv.items };

    removeItem(inv, 'wall_ring');

    expect(inv.items).toEqual(originalItems);
  });

  it('useBookOfBuilding returns new state and inventory references', () => {
    const state = makeVillage({
      buildings: [
        {
          instanceId: 'cannon-1',
          buildingId: 'cannon',
          buildingType: 'defense',
          level: 3,
          gridX: 5,
          gridY: 5,
          isUpgrading: true,
          upgradeTimeRemaining: 3600,
          assignedBuilder: 1,
        },
      ],
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'cannon-1', timeRemaining: 3600 },
        { id: 2, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
        { id: 3, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 4, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
        { id: 5, isUnlocked: false, assignedTo: null, timeRemaining: 0 },
      ],
    });
    const inv = makeInventoryWith({ book_building: 1 });

    const result = useBookOfBuilding(state, inv, 'cannon-1');

    expect(result).not.toBeNull();
    expect(result!.state).not.toBe(state);
    expect(result!.state.buildings).not.toBe(state.buildings);
    expect(result!.state.builders).not.toBe(state.builders);
    expect(result!.inventory).not.toBe(inv);
  });

  it('useRune returns new state and inventory references', () => {
    const state = makeVillage();
    const inv = makeInventoryWith({ rune_gold: 1 });

    const result = useRune(state, inv, 'rune_gold', 500000);

    expect(result).not.toBeNull();
    expect(result!.state).not.toBe(state);
    expect(result!.state.resources).not.toBe(state.resources);
    expect(result!.inventory).not.toBe(inv);
  });

  it('useWallRing returns new state and inventory references', () => {
    const state = makeVillage({
      walls: [{ instanceId: 'wall-1', level: 1, gridX: 0, gridY: 0 }],
    });
    const inv = makeInventoryWith({ wall_ring: 5 });

    const result = useWallRing(state, inv, 'wall-1');

    expect(result).not.toBeNull();
    expect(result!.state).not.toBe(state);
    expect(result!.state.walls).not.toBe(state.walls);
    expect(result!.inventory).not.toBe(inv);
  });
});
