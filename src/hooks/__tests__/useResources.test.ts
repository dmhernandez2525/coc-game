import { describe, it, expect } from 'vitest';
import type { VillageState, PlacedBuilding } from '../../types/village';
import { tickBuildingUpgrades } from '../useResources';

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
