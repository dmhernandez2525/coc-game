// Integration tests for super troops replacing base troops in training
// and being deployable in battle with their modified stats.

import type { VillageState, PlacedBuilding } from '../../types/village.ts';
import type { BattleState } from '../../types/battle.ts';
import { getTroop } from '../../data/loaders/troop-loader.ts';
import { getSuperTroop } from '../super-troop-manager.ts';
import {
  getVillageSuperTroopState,
  boostVillageSuperTroop,
  unboostVillageSuperTroop,
  tickVillageSuperTroopBoosts,
  getVillageActiveSuperTroop,
  getBoostDurationMs,
} from '../super-troop-manager.ts';
import { getAvailableTroops, trainTroop, getTrainingCost } from '../army-manager.ts';
import { deployTroop } from '../battle-engine.ts';
import { tickSuperTroopBoostState } from '../../hooks/useResources.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuilding(
  buildingId: string,
  buildingType: PlacedBuilding['buildingType'],
  level = 1,
): PlacedBuilding {
  return {
    instanceId: `bld_${buildingId}_${level}`,
    buildingId,
    buildingType,
    level,
    gridX: 0,
    gridY: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

function makeVillage(overrides?: Partial<VillageState>): VillageState {
  return {
    version: 1,
    townHallLevel: 11,
    buildings: [
      makeBuilding('Army Camp', 'army'),
      makeBuilding('Barracks', 'army'),
    ],
    walls: [],
    traps: [],
    obstacles: [],
    resources: { gold: 100000, elixir: 100000, darkElixir: 50000, gems: 500 },
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

function boostedVillage(): VillageState {
  const boosted = boostVillageSuperTroop(makeVillage(), 'Super Barbarian');
  if (!boosted) throw new Error('boost failed in test setup');
  return boosted;
}

function makeBattleState(troops: Array<{ name: string; level: number; count: number }>): BattleState {
  return {
    phase: 'active',
    timeRemaining: 180,
    destructionPercent: 0,
    stars: 0,
    deployedTroops: [],
    defenses: [],
    buildings: [],
    spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: troops,
    availableSpells: [],
    availableHeroes: [],
  };
}

// ---------------------------------------------------------------------------
// Troop resolution
// ---------------------------------------------------------------------------
describe('getTroop super troop resolution', () => {
  it('resolves a super troop by name', () => {
    const troop = getTroop('Super Barbarian');
    expect(troop).toBeDefined();
    expect(troop?.housingSpace).toBe(5);
    expect(troop?.type).toBe('elixir'); // inherited from Barbarian
  });

  it('exposes the super troop modified stats per level', () => {
    const troop = getTroop('Super Barbarian');
    const level8 = troop?.levels.find((l) => l.level === 8);
    expect(level8?.dps).toBe(180);
    expect(level8?.hp).toBe(1000);
  });

  it('still resolves regular troops first', () => {
    expect(getTroop('Barbarian')?.housingSpace).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Village boost lifecycle
// ---------------------------------------------------------------------------
describe('boostVillageSuperTroop', () => {
  it('activates the boost and pays the dark elixir cost', () => {
    const state = boostedVillage();
    const boostCost = getSuperTroop('Super Barbarian')?.boostCost ?? 0;
    expect(state.resources.darkElixir).toBe(50000 - boostCost);
    expect(getVillageActiveSuperTroop(state, 'Barbarian')).toBe('Super Barbarian');
  });

  it('returns null below TH11', () => {
    expect(boostVillageSuperTroop(makeVillage({ townHallLevel: 10 }), 'Super Barbarian')).toBeNull();
  });

  it('enforces the two-boost maximum', () => {
    let state: VillageState | null = boostedVillage();
    state = boostVillageSuperTroop(state, 'Super Archer');
    expect(state).not.toBeNull();
    expect(boostVillageSuperTroop(state!, 'Sneaky Goblin')).toBeNull();
  });

  it('unboost removes the active boost', () => {
    const state = unboostVillageSuperTroop(boostedVillage(), 'Super Barbarian');
    expect(getVillageSuperTroopState(state).activeBoosts).toHaveLength(0);
  });
});

describe('boost timers on the game clock', () => {
  it('expires a boost after 3 days of game time', () => {
    const state = boostedVillage();
    const almostDone = tickVillageSuperTroopBoosts(state, getBoostDurationMs() - 1);
    expect(getVillageSuperTroopState(almostDone).activeBoosts).toHaveLength(1);
    const done = tickVillageSuperTroopBoosts(almostDone, 1);
    expect(getVillageSuperTroopState(done).activeBoosts).toHaveLength(0);
  });

  it('tickSuperTroopBoostState scales with the game clock speed', () => {
    const state = { ...boostedVillage(), gameClockSpeed: 60 };
    const ticked = tickSuperTroopBoostState(state, getBoostDurationMs() / 60);
    expect(getVillageSuperTroopState(ticked).activeBoosts).toHaveLength(0);
  });

  it('returns the same state when no boost is active', () => {
    const state = makeVillage();
    expect(tickVillageSuperTroopBoosts(state, 1000)).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Training replacement
// ---------------------------------------------------------------------------
describe('super troops replace the base troop in training', () => {
  it('getAvailableTroops swaps in the super variant while boosted', () => {
    const roster = getAvailableTroops(boostedVillage());
    expect(roster.some((t) => t.name === 'Super Barbarian')).toBe(true);
    expect(roster.some((t) => t.name === 'Barbarian')).toBe(false);
  });

  it('leaves the roster unchanged without a boost', () => {
    const roster = getAvailableTroops(makeVillage());
    expect(roster.some((t) => t.name === 'Barbarian')).toBe(true);
    expect(roster.some((t) => t.name === 'Super Barbarian')).toBe(false);
  });

  it('trains the super troop at its lowest defined level', () => {
    const trained = trainTroop(boostedVillage(), 'Super Barbarian');
    expect(trained).not.toBeNull();
    const entry = trained!.army.find((t) => t.name === 'Super Barbarian');
    expect(entry?.count).toBe(1);
    expect(entry?.level).toBe(8); // Super Barbarian stats start at level 8
  });

  it('blocks training the base troop while its super variant is boosted', () => {
    expect(trainTroop(boostedVillage(), 'Barbarian')).toBeNull();
  });

  it('charges training cost from the super troop housing space', () => {
    const cost = getTrainingCost('Super Barbarian');
    expect(cost).toEqual({ amount: 250, resource: 'Elixir', time: 25 });
  });
});

// ---------------------------------------------------------------------------
// Battle deployment
// ---------------------------------------------------------------------------
describe('super troops in battle', () => {
  it('deployTroop deploys a super troop with its modified stats', () => {
    const state = makeBattleState([{ name: 'Super Barbarian', level: 8, count: 1 }]);
    const next = deployTroop(state, 'Super Barbarian', 5, 5);
    expect(next).not.toBeNull();
    const deployed = next!.deployedTroops[0]!;
    expect(deployed.name).toBe('Super Barbarian');
    expect(deployed.maxHp).toBe(1000);
    expect(deployed.dps).toBe(180);
  });

  it('deployTroop still returns null for unknown troop names', () => {
    const state = makeBattleState([{ name: 'Totally Fake Troop', level: 1, count: 1 }]);
    expect(deployTroop(state, 'Totally Fake Troop', 5, 5)).toBeNull();
  });
});
