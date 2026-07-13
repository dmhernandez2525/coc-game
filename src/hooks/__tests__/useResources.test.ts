import { describe, it, expect } from 'vitest';
import type { VillageState, PlacedBuilding } from '../../types/village';
import { tickBuildingUpgrades, tickVillage } from '../useResources';

/**
 * Returns a minimal but complete VillageState. Any fields passed in
 * `overrides` are shallow-merged on top of the defaults.
 */
function makeVillageState(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 5,
    buildings: [],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 1000, elixir: 1000, darkElixir: 0, gems: 50 },
    builders: [
      { id: 1, isUnlocked: true, assignedTo: null, timeRemaining: 0 },
    ],
    army: [],
    spells: [],
    heroes: [],
    trophies: 200,
    league: 'Silver I',
    campaignProgress: { levels: [], totalStars: 0 },
    obstacleCounter: 0,
    lastSaveTimestamp: 1000,
    totalPlayTime: 0,
    gameClockSpeed: 1,
    ...overrides,
  };
}

function makeBuilding(overrides?: Partial<PlacedBuilding>): PlacedBuilding {
  return {
    instanceId: 'bld_1',
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

// ---------------------------------------------------------------------------
// tickBuildingUpgrades
// ---------------------------------------------------------------------------

describe('tickBuildingUpgrades', () => {
  it('returns the same state when nothing is upgrading', () => {
    const state = makeVillageState({ buildings: [makeBuilding()] });
    expect(tickBuildingUpgrades(state, 1000)).toBe(state);
  });

  it('decrements upgradeTimeRemaining by the elapsed seconds', () => {
    const state = makeVillageState({
      buildings: [
        makeBuilding({ isUpgrading: true, upgradeTimeRemaining: 60 }),
      ],
    });

    const next = tickBuildingUpgrades(state, 1000);

    expect(next.buildings[0]?.upgradeTimeRemaining).toBe(59);
    expect(next.buildings[0]?.isUpgrading).toBe(true);
    expect(next.buildings[0]?.level).toBe(1);
  });

  it('scales elapsed time by gameClockSpeed', () => {
    const state = makeVillageState({
      gameClockSpeed: 10,
      buildings: [
        makeBuilding({ isUpgrading: true, upgradeTimeRemaining: 60 }),
      ],
    });

    const next = tickBuildingUpgrades(state, 1000);

    expect(next.buildings[0]?.upgradeTimeRemaining).toBe(50);
  });

  it('completes the upgrade when the remaining time reaches zero', () => {
    const state = makeVillageState({
      builders: [
        { id: 1, isUnlocked: true, assignedTo: 'bld_1', timeRemaining: 2 },
      ],
      buildings: [
        makeBuilding({
          isUpgrading: true,
          upgradeTimeRemaining: 2,
          assignedBuilder: 1,
        }),
      ],
    });

    const next = tickBuildingUpgrades(state, 2000);

    const building = next.buildings[0];
    expect(building?.level).toBe(2);
    expect(building?.isUpgrading).toBe(false);
    expect(building?.upgradeTimeRemaining).toBe(0);
    expect(building?.assignedBuilder).toBeNull();
    // The assigned builder is freed for the next upgrade
    expect(next.builders[0]?.assignedTo).toBeNull();
  });

  it('does not complete an upgrade before the time is up', () => {
    const state = makeVillageState({
      buildings: [
        makeBuilding({ isUpgrading: true, upgradeTimeRemaining: 5 }),
      ],
    });

    const next = tickBuildingUpgrades(state, 1000);

    expect(next.buildings[0]?.level).toBe(1);
    expect(next.buildings[0]?.isUpgrading).toBe(true);
  });

  it('only completes the buildings that reached zero', () => {
    const state = makeVillageState({
      buildings: [
        makeBuilding({ instanceId: 'bld_1', isUpgrading: true, upgradeTimeRemaining: 1 }),
        makeBuilding({ instanceId: 'bld_2', isUpgrading: true, upgradeTimeRemaining: 30 }),
      ],
    });

    const next = tickBuildingUpgrades(state, 1000);

    expect(next.buildings[0]?.level).toBe(2);
    expect(next.buildings[0]?.isUpgrading).toBe(false);
    expect(next.buildings[1]?.level).toBe(1);
    expect(next.buildings[1]?.isUpgrading).toBe(true);
    expect(next.buildings[1]?.upgradeTimeRemaining).toBe(29);
  });

  it('does not mutate the input state', () => {
    const state = makeVillageState({
      buildings: [
        makeBuilding({ isUpgrading: true, upgradeTimeRemaining: 60 }),
      ],
    });

    tickBuildingUpgrades(state, 1000);

    expect(state.buildings[0]?.upgradeTimeRemaining).toBe(60);
    expect(state.buildings[0]?.isUpgrading).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tickVillage (the real game-loop composition: potions, production, upgrades,
// hero recovery, and super troop boost timers all advance together)
// ---------------------------------------------------------------------------

/** A Gold Mine collector (produces 200/hour, 1000 capacity, at level 1). */
function makeGoldMine(): PlacedBuilding {
  return makeBuilding({
    instanceId: 'mine_1',
    buildingId: 'Gold Mine',
    buildingType: 'resource_collector',
    level: 1,
    uncollectedResources: 0,
  });
}

describe('tickVillage', () => {
  it('ticks down active potion timers by the elapsed game-clock time', () => {
    const state = makeVillageState({
      activePotions: [{ itemId: 'resource_potion', remainingMs: 10_000 }],
    });

    const next = tickVillage(state, 1000);

    expect(next.activePotions?.[0]?.remainingMs).toBe(9000);
  });

  it('removes a potion once its timer runs out', () => {
    const state = makeVillageState({
      activePotions: [{ itemId: 'research_potion', remainingMs: 1000 }],
    });

    const next = tickVillage(state, 1000);

    expect(next.activePotions).toEqual([]);
  });

  it('applies the resource potion collector-speed multiplier to production', () => {
    const base = makeVillageState({ buildings: [makeGoldMine()] });
    const boosted = makeVillageState({
      buildings: [makeGoldMine()],
      activePotions: [{ itemId: 'resource_potion', remainingMs: 60_000 }],
    });

    const plain = tickVillage(base, 1000);
    const withPotion = tickVillage(boosted, 1000);

    const plainProduced = plain.buildings[0]?.uncollectedResources ?? 0;
    const boostedProduced = withPotion.buildings[0]?.uncollectedResources ?? 0;

    // resource_potion grants a 2x collector-speed multiplier
    expect(plainProduced).toBeGreaterThan(0);
    expect(boostedProduced).toBeCloseTo(plainProduced * 2, 6);
  });

  it('expires a super troop boost when its timer runs out (real loop path)', () => {
    const state = makeVillageState({
      superTroopBoosts: [
        { baseTroopName: 'Barbarian', superTroopName: 'Super Barbarian', remainingDurationMs: 500 },
      ],
    });

    const next = tickVillage(state, 1000);

    expect(next.superTroopBoosts).toEqual([]);
  });

  it('keeps an unexpired super troop boost ticking down', () => {
    const state = makeVillageState({
      superTroopBoosts: [
        { baseTroopName: 'Archer', superTroopName: 'Super Archer', remainingDurationMs: 10_000 },
      ],
    });

    const next = tickVillage(state, 1000);

    expect(next.superTroopBoosts?.[0]?.remainingDurationMs).toBe(9000);
    expect(next.superTroopBoosts?.[0]?.superTroopName).toBe('Super Archer');
  });

  it('scales super troop boost decay by the game clock speed', () => {
    const state = makeVillageState({
      gameClockSpeed: 10,
      superTroopBoosts: [
        { baseTroopName: 'Archer', superTroopName: 'Super Archer', remainingDurationMs: 30_000 },
      ],
    });

    const next = tickVillage(state, 1000);

    expect(next.superTroopBoosts?.[0]?.remainingDurationMs).toBe(20_000);
  });

  it('applies the Research Potion and game speed to the active Laboratory job', () => {
    const state = makeVillageState({
      gameClockSpeed: 2,
      activePotions: [{ itemId: 'research_potion', remainingMs: 60_000 }],
      activeResearch: {
        troopName: 'Barbarian', fromLevel: 1, targetLevel: 2, resource: 'elixir',
        cost: 1000, totalTimeSeconds: 100, remainingTimeSeconds: 100,
      },
    });
    const next = tickVillage(state, 1000);
    expect(next.activeResearch?.remainingTimeSeconds).toBe(52);
  });

  it('does not mutate the input state', () => {
    const state = makeVillageState({
      buildings: [makeGoldMine()],
      activePotions: [{ itemId: 'resource_potion', remainingMs: 10_000 }],
      superTroopBoosts: [
        { baseTroopName: 'Barbarian', superTroopName: 'Super Barbarian', remainingDurationMs: 10_000 },
      ],
    });

    tickVillage(state, 1000);

    expect(state.activePotions?.[0]?.remainingMs).toBe(10_000);
    expect(state.superTroopBoosts?.[0]?.remainingDurationMs).toBe(10_000);
    expect(state.buildings[0]?.uncollectedResources).toBe(0);
  });
});
