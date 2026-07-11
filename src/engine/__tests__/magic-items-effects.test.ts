// Tests for real magic item effects: books complete upgrades, potions run
// timed boosts on the game clock, runes fill storages, wall rings upgrade
// walls, and items can be bought with gems.

import type { VillageState, PlacedBuilding, OwnedHero, PlacedWall } from '../../types/village.ts';
import {
  applyVillageMagicItem,
  getVillageInventory,
  addVillageItem,
  buyMagicItemWithGems,
  getItemGemCost,
  getItemCount,
  isPotionActive,
  tickPotions,
  getPotionMultipliers,
  applyPowerPotionToArmy,
  getHeroPotionLevel,
} from '../magic-items-manager.ts';
import { getStorageCapacity } from '../resource-manager.ts';
import { tickVillage } from '../../hooks/useResources.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

function makeBuilding(
  buildingId: string,
  overrides?: Partial<PlacedBuilding>,
): PlacedBuilding {
  return {
    instanceId: `bld_${buildingId}`,
    buildingId,
    buildingType: 'other',
    level: 1,
    gridX: 0,
    gridY: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeHero(overrides?: Partial<OwnedHero>): OwnedHero {
  return {
    name: 'Barbarian King',
    level: 5,
    currentHp: 1000,
    isRecovering: false,
    recoveryTimeRemaining: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    equippedItems: [null, null],
    assignedPet: null,
    ...overrides,
  };
}

function makeWall(instanceId: string, level: number): PlacedWall {
  return { instanceId, level, gridX: 0, gridY: 0 };
}

function makeVillage(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 10,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 1000, elixir: 1000, darkElixir: 100, gems: 5000 },
    builders: [],
    army: [],
    spells: [],
    heroes: [],
    trophies: 0,
    league: 'Unranked',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: 0,
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

function withItem(state: VillageState, itemId: string, count = 1): VillageState {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    const added = addVillageItem(next, itemId);
    if (!added) throw new Error(`could not add ${itemId} in test setup`);
    next = added;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------
describe('applyVillageMagicItem books', () => {
  it('Book of Building completes an in-progress building upgrade', () => {
    const state = withItem(makeVillage({
      buildings: [makeBuilding('Cannon', { isUpgrading: true, upgradeTimeRemaining: 3600, assignedBuilder: 1 })],
      builders: [{ id: 1, isUnlocked: true, assignedTo: 'bld_Cannon', timeRemaining: 3600 }],
    }), 'book_building');

    const used = applyVillageMagicItem(state, 'book_building');
    expect(used).not.toBeNull();
    const building = used!.buildings[0]!;
    expect(building.level).toBe(2);
    expect(building.isUpgrading).toBe(false);
    expect(used!.builders[0]?.assignedTo).toBeNull();
    expect(getItemCount(getVillageInventory(used!), 'book_building')).toBe(0);
  });

  it('does not consume the book when nothing is upgrading', () => {
    const state = withItem(makeVillage(), 'book_building');
    expect(applyVillageMagicItem(state, 'book_building')).toBeNull();
    expect(getItemCount(getVillageInventory(state), 'book_building')).toBe(1);
  });

  it('Book of Heroes completes an in-progress hero upgrade', () => {
    const state = withItem(makeVillage({
      heroes: [makeHero({ isUpgrading: true, upgradeTimeRemaining: 7200 })],
    }), 'book_heroes');

    const used = applyVillageMagicItem(state, 'book_heroes');
    expect(used).not.toBeNull();
    const hero = used!.heroes[0]!;
    expect(hero.level).toBe(6);
    expect(hero.isUpgrading).toBe(false);
    expect(hero.upgradeTimeRemaining).toBe(0);
  });

  it('Book of Spells only completes spell factory upgrades', () => {
    const state = withItem(makeVillage({
      buildings: [
        makeBuilding('Cannon', { isUpgrading: true, upgradeTimeRemaining: 100 }),
        makeBuilding('Spell Factory', { isUpgrading: true, upgradeTimeRemaining: 100 }),
      ],
    }), 'book_spells');

    const used = applyVillageMagicItem(state, 'book_spells');
    expect(used).not.toBeNull();
    expect(used!.buildings.find((b) => b.buildingId === 'Cannon')?.isUpgrading).toBe(true);
    expect(used!.buildings.find((b) => b.buildingId === 'Spell Factory')?.isUpgrading).toBe(false);
  });

  it('Book of Everything falls back to a hero when no building is upgrading', () => {
    const state = withItem(makeVillage({
      heroes: [makeHero({ isUpgrading: true, upgradeTimeRemaining: 7200 })],
    }), 'book_everything');

    const used = applyVillageMagicItem(state, 'book_everything');
    expect(used).not.toBeNull();
    expect(used!.heroes[0]?.level).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Runes and wall rings
// ---------------------------------------------------------------------------
describe('applyVillageMagicItem runes and wall rings', () => {
  it('Rune of Gold fills gold storage to capacity', () => {
    const state = withItem(makeVillage(), 'rune_gold');
    const caps = getStorageCapacity(state);
    const used = applyVillageMagicItem(state, 'rune_gold');
    expect(used?.resources.gold).toBe(caps.gold);
  });

  it('is not consumed when the storage is already full', () => {
    const base = makeVillage();
    const caps = getStorageCapacity(base);
    const state = withItem(
      { ...base, resources: { ...base.resources, gold: caps.gold } },
      'rune_gold',
    );
    expect(applyVillageMagicItem(state, 'rune_gold')).toBeNull();
  });

  it('Wall Ring upgrades the lowest-level wall', () => {
    const state = withItem(makeVillage({
      walls: [makeWall('wall_1', 4), makeWall('wall_2', 2)],
    }), 'wall_ring');

    const used = applyVillageMagicItem(state, 'wall_ring');
    expect(used).not.toBeNull();
    expect(used!.walls.find((w) => w.instanceId === 'wall_2')?.level).toBe(3);
    expect(used!.walls.find((w) => w.instanceId === 'wall_1')?.level).toBe(4);
  });

  it('Wall Ring has no effect without walls', () => {
    const state = withItem(makeVillage(), 'wall_ring');
    expect(applyVillageMagicItem(state, 'wall_ring')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Potions
// ---------------------------------------------------------------------------
describe('potion boosts', () => {
  it('drinking a potion starts its timed boost', () => {
    const state = withItem(makeVillage(), 'builder_potion');
    const used = applyVillageMagicItem(state, 'builder_potion');
    expect(used).not.toBeNull();
    expect(isPotionActive(used!, 'builder_potion')).toBe(true);
    expect(used!.activePotions?.[0]?.remainingMs).toBe(HOUR_MS);
  });

  it('drinking the same potion again extends the duration', () => {
    const state = withItem(makeVillage(), 'builder_potion', 2);
    const once = applyVillageMagicItem(state, 'builder_potion')!;
    const twice = applyVillageMagicItem(once, 'builder_potion')!;
    expect(twice.activePotions?.[0]?.remainingMs).toBe(2 * HOUR_MS);
  });

  it('tickPotions expires boosts on the game clock', () => {
    const used = applyVillageMagicItem(withItem(makeVillage(), 'builder_potion'), 'builder_potion')!;
    const ticked = tickPotions(used, HOUR_MS - 1);
    expect(isPotionActive(ticked, 'builder_potion')).toBe(true);
    const done = tickPotions(ticked, 1);
    expect(isPotionActive(done, 'builder_potion')).toBe(false);
    expect(done.activePotions).toHaveLength(0);
  });

  it('tickPotions scales with game clock speed', () => {
    const used = applyVillageMagicItem(withItem(makeVillage(), 'builder_potion'), 'builder_potion')!;
    const fast = { ...used, gameClockSpeed: 60 };
    const done = tickPotions(fast, HOUR_MS / 60);
    expect(isPotionActive(done, 'builder_potion')).toBe(false);
  });

  it('getPotionMultipliers reflects active potions', () => {
    const base = makeVillage();
    expect(getPotionMultipliers(base)).toEqual({
      builderSpeed: 1,
      collectorSpeed: 1,
      trainingSpeed: 1,
      labSpeed: 1,
    });

    const boosted = applyVillageMagicItem(withItem(base, 'builder_potion'), 'builder_potion')!;
    expect(getPotionMultipliers(boosted).builderSpeed).toBe(10);
  });

  it('builder potion speeds up building upgrades in the village tick', () => {
    const upgrading = makeVillage({
      buildings: [makeBuilding('Cannon', { isUpgrading: true, upgradeTimeRemaining: 100 })],
    });
    const boosted = applyVillageMagicItem(withItem(upgrading, 'builder_potion'), 'builder_potion')!;

    // 10 seconds of real time at 10x builder speed removes 100 seconds
    const ticked = tickVillage(boosted, 10_000);
    const building = ticked.buildings.find((b) => b.buildingId === 'Cannon');
    expect(building?.isUpgrading).toBe(false);

    // Without the potion the same tick leaves 90 seconds remaining
    const unticked = tickVillage(upgrading, 10_000);
    expect(unticked.buildings[0]?.upgradeTimeRemaining).toBe(90);
  });

  it('Power Potion raises army troops to their max data level', () => {
    const army = applyPowerPotionToArmy([{ name: 'Barbarian', level: 1, count: 5 }]);
    expect(army[0]?.level).toBe(12);
    expect(army[0]?.count).toBe(5);
  });

  it('Hero Potion raises a hero to max level for battle', () => {
    expect(getHeroPotionLevel('Barbarian King', 10)).toBe(105);
    expect(getHeroPotionLevel('Unknown Hero', 10)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Acquisition
// ---------------------------------------------------------------------------
describe('buying magic items with gems', () => {
  it('every defined item has a gem price', () => {
    for (const itemId of [
      'book_heroes', 'book_building', 'book_spells', 'book_everything',
      'research_potion', 'resource_potion', 'builder_potion', 'training_potion',
      'power_potion', 'hero_potion', 'rune_gold', 'rune_elixir',
      'rune_dark_elixir', 'wall_ring',
    ]) {
      expect(getItemGemCost(itemId)).toBeGreaterThan(0);
    }
  });

  it('uses the Trader price from game data', () => {
    expect(getItemGemCost('wall_ring')).toBe(175);
    expect(getItemGemCost('book_heroes')).toBe(500);
  });

  it('buys an item and deducts gems', () => {
    const state = buyMagicItemWithGems(makeVillage(), 'wall_ring');
    expect(state).not.toBeNull();
    expect(getItemCount(getVillageInventory(state!), 'wall_ring')).toBe(1);
    expect(state!.resources.gems).toBe(5000 - 175);
  });

  it('refuses when gems are insufficient', () => {
    const poor = makeVillage({ resources: { gold: 0, elixir: 0, darkElixir: 0, gems: 10 } });
    expect(buyMagicItemWithGems(poor, 'wall_ring')).toBeNull();
  });

  it('refuses when the stack is full', () => {
    const state = withItem(makeVillage(), 'book_heroes'); // maxStack 1
    expect(buyMagicItemWithGems(state, 'book_heroes')).toBeNull();
  });

  it('refuses unknown items', () => {
    expect(buyMagicItemWithGems(makeVillage(), 'nonexistent')).toBeNull();
  });
});
