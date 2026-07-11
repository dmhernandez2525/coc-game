// Battle engine integration for attacker clan castle troops and siege
// machines: offensive CC deploy, siege deploy, Town Hall pathing, and
// carried-troop release. Math.random is pinned so deploys are deterministic.

import type { BattleState, DeployedTroop } from '../../types/battle.ts';
import type { PlacedBuilding } from '../../types/village.ts';
import {
  initBattleState,
  deployAttackerCC,
  deploySiegeToBattle,
  tickBattle,
  isBattleOver,
} from '../battle-engine.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CC_TROOPS = [{ name: 'Archer', level: 1, count: 5 }];

function makePlacedBuilding(
  id: string,
  type: PlacedBuilding['buildingType'],
  gridX: number,
  gridY: number,
): PlacedBuilding {
  return {
    instanceId: `test_${id}_${gridX}_${gridY}`,
    buildingId: id,
    buildingType: type,
    level: 1,
    gridX,
    gridY,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

/** A defender base with a nearby Army Camp and a distant Town Hall. */
function makeDefender() {
  return {
    buildings: [
      makePlacedBuilding('Army Camp', 'army', 5, 5),
      makePlacedBuilding('Town Hall', 'other', 30, 30),
    ],
  };
}

function makeSiegeUnit(overrides?: Partial<DeployedTroop>): DeployedTroop {
  return {
    id: 'siege_Wall Wrecker_test',
    name: 'Wall Wrecker',
    level: 1,
    currentHp: 5500,
    maxHp: 5500,
    x: 0,
    y: 0,
    targetId: null,
    state: 'idle',
    dps: 250,
    baseDps: 250,
    attackRange: 1,
    movementSpeed: 12,
    isFlying: false,
    isSiegeMachine: true,
    canJumpWalls: true,
    ...overrides,
  };
}

function makeBattleState(overrides?: Partial<BattleState>): BattleState {
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
    availableTroops: [],
    availableSpells: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// initBattleState: attacker CC and siege setup
// ---------------------------------------------------------------------------

describe('initBattleState attacker reinforcements', () => {
  it('stages attacker CC troops as an undeployed reserve', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerCastleTroops: CC_TROOPS,
    });

    expect(state.attackerCC).toEqual({ troops: CC_TROOPS, deployed: false });
  });

  it('stages the attacker siege machine as undeployed', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerSiege: { name: 'Wall Wrecker', level: 1 },
    });

    expect(state.attackerSiege).toEqual({ name: 'Wall Wrecker', level: 1, deployed: false });
  });

  it('omits both when no reinforcements are brought', () => {
    const state = initBattleState(makeDefender(), [], []);

    expect(state.attackerCC).toBeUndefined();
    expect(state.attackerSiege).toBeUndefined();
  });

  it('omits attackerCC when the castle troop list is empty', () => {
    const state = initBattleState(makeDefender(), [], [], { attackerCastleTroops: [] });

    expect(state.attackerCC).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deployAttackerCC
// ---------------------------------------------------------------------------

describe('deployAttackerCC', () => {
  it('spawns the castle troops at the deploy point as attackers', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerCastleTroops: CC_TROOPS,
    });
    const next = deployAttackerCC(state, 10, 12);

    expect(next).not.toBeNull();
    const archers = next!.deployedTroops.filter((t) => t.name === 'Archer');
    expect(archers).toHaveLength(5);
    for (const archer of archers) {
      // Math.random pinned to 0.5 makes all offsets zero
      expect(archer.x).toBe(10);
      expect(archer.y).toBe(12);
      expect(archer.isDefender).toBeUndefined();
    }
    expect(next!.attackerCC?.deployed).toBe(true);
  });

  it('only deploys once per battle', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerCastleTroops: CC_TROOPS,
    });
    const once = deployAttackerCC(state, 10, 12);

    expect(deployAttackerCC(once!, 10, 12)).toBeNull();
  });

  it('returns null when no CC troops were brought', () => {
    const state = initBattleState(makeDefender(), [], []);

    expect(deployAttackerCC(state, 10, 12)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deploySiegeToBattle
// ---------------------------------------------------------------------------

describe('deploySiegeToBattle', () => {
  it('deploys the siege machine and marks it used', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerSiege: { name: 'Wall Wrecker', level: 1 },
    });
    const next = deploySiegeToBattle(state, 2, 3);

    expect(next).not.toBeNull();
    const siege = next!.deployedTroops.find((t) => t.isSiegeMachine);
    expect(siege).toBeDefined();
    expect(siege!.name).toBe('Wall Wrecker');
    expect(siege!.x).toBe(2);
    expect(siege!.y).toBe(3);
    expect(next!.attackerSiege?.deployed).toBe(true);
  });

  it('allows only one siege deploy per attack', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerSiege: { name: 'Wall Wrecker', level: 1 },
    });
    const once = deploySiegeToBattle(state, 2, 3);

    expect(deploySiegeToBattle(once!, 4, 5)).toBeNull();
  });

  it('loads undeployed CC troops into the siege machine', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerCastleTroops: CC_TROOPS,
      attackerSiege: { name: 'Wall Wrecker', level: 1 },
    });
    const next = deploySiegeToBattle(state, 2, 3);

    expect(next).not.toBeNull();
    const siege = next!.deployedTroops.find((t) => t.isSiegeMachine);
    expect(siege!.carriedTroops).toEqual(CC_TROOPS);
    // The CC deploy is spent: it rides inside the machine now
    expect(next!.attackerCC?.deployed).toBe(true);
    expect(deployAttackerCC(next!, 10, 10)).toBeNull();
  });

  it('deploys empty when the CC troops were already dropped', () => {
    const state = initBattleState(makeDefender(), [], [], {
      attackerCastleTroops: CC_TROOPS,
      attackerSiege: { name: 'Wall Wrecker', level: 1 },
    });
    const afterCC = deployAttackerCC(state, 10, 12);
    const next = deploySiegeToBattle(afterCC!, 2, 3);

    expect(next).not.toBeNull();
    const siege = next!.deployedTroops.find((t) => t.isSiegeMachine);
    expect(siege!.carriedTroops).toBeUndefined();
  });

  it('returns null when no siege machine was brought', () => {
    const state = initBattleState(makeDefender(), [], []);

    expect(deploySiegeToBattle(state, 2, 3)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Siege Town Hall pathing
// ---------------------------------------------------------------------------

describe('siege machine Town Hall pathing', () => {
  it('targets the Town Hall even when other buildings are closer', () => {
    const defender = makeDefender();
    const thId = defender.buildings.find((b) => b.buildingId === 'Town Hall')!.instanceId;
    const state = deploySiegeToBattle(
      initBattleState(defender, [], [], { attackerSiege: { name: 'Wall Wrecker', level: 1 } }),
      0, 0,
    );

    const next = tickBattle(state!, 50);

    const siege = next.deployedTroops.find((t) => t.isSiegeMachine);
    expect(siege!.targetId).toBe(thId);
    expect(siege!.state).toBe('moving');
  });

  it('moves toward the Town Hall over successive ticks', () => {
    const state = deploySiegeToBattle(
      initBattleState(makeDefender(), [], [], { attackerSiege: { name: 'Wall Wrecker', level: 1 } }),
      0, 0,
    );

    let current = state!;
    for (let i = 0; i < 20; i++) current = tickBattle(current, 50);

    const siege = current.deployedTroops.find((t) => t.isSiegeMachine);
    // Started at (0,0) heading for the TH at (30,30): both axes advance
    expect(siege!.x).toBeGreaterThan(0);
    expect(siege!.y).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Carried CC troop release
// ---------------------------------------------------------------------------

describe('siege carried troop release', () => {
  it('releases carried troops when the siege machine dies', () => {
    const state = makeBattleState({
      buildings: [{
        instanceId: 'bb_th', name: 'Town Hall', currentHp: 500, maxHp: 500,
        x: 30, y: 30, isDestroyed: false, weight: 1,
      }],
      deployedTroops: [makeSiegeUnit({
        state: 'dead', currentHp: 0, x: 8, y: 9, carriedTroops: CC_TROOPS,
      })],
    });

    const next = tickBattle(state, 50);

    const archers = next.deployedTroops.filter((t) => t.name === 'Archer');
    expect(archers).toHaveLength(5);
    for (const archer of archers) {
      expect(archer.x).toBe(8);
      expect(archer.y).toBe(9);
    }
    const siege = next.deployedTroops.find((t) => t.isSiegeMachine);
    expect(siege!.carriedTroops).toBeUndefined();
  });

  it('releases carried troops when the siege machine reaches the Town Hall', () => {
    const state = makeBattleState({
      buildings: [{
        instanceId: 'bb_th', name: 'Town Hall', currentHp: 5000, maxHp: 5000,
        x: 30, y: 30, isDestroyed: false, weight: 1,
      }],
      deployedTroops: [makeSiegeUnit({ x: 30, y: 30, carriedTroops: CC_TROOPS })],
    });

    const next = tickBattle(state, 50);

    expect(next.deployedTroops.filter((t) => t.name === 'Archer')).toHaveLength(5);
    const siege = next.deployedTroops.find((t) => t.isSiegeMachine);
    expect(siege!.carriedTroops).toBeUndefined();
  });

  it('keeps troops on board while the siege is alive and far from the Town Hall', () => {
    const state = makeBattleState({
      buildings: [{
        instanceId: 'bb_th', name: 'Town Hall', currentHp: 5000, maxHp: 5000,
        x: 30, y: 30, isDestroyed: false, weight: 1,
      }],
      deployedTroops: [makeSiegeUnit({ x: 0, y: 0, carriedTroops: CC_TROOPS })],
    });

    const next = tickBattle(state, 50);

    expect(next.deployedTroops.filter((t) => t.name === 'Archer')).toHaveLength(0);
    const siege = next.deployedTroops.find((t) => t.isSiegeMachine);
    expect(siege!.carriedTroops).toEqual(CC_TROOPS);
  });
});

// ---------------------------------------------------------------------------
// Battle end conditions with reinforcements pending
// ---------------------------------------------------------------------------

describe('battle end with pending reinforcements', () => {
  it('is not over while the attacker CC is still undeployed', () => {
    const state = makeBattleState({
      attackerCC: { troops: CC_TROOPS, deployed: false },
    });

    expect(isBattleOver(state)).toBe(false);
  });

  it('is not over while the siege machine is still undeployed', () => {
    const state = makeBattleState({
      attackerSiege: { name: 'Wall Wrecker', level: 1, deployed: false },
    });

    expect(isBattleOver(state)).toBe(false);
  });

  it('is over once reinforcements are spent and no attackers remain', () => {
    const state = makeBattleState({
      attackerCC: { troops: CC_TROOPS, deployed: true },
      attackerSiege: { name: 'Wall Wrecker', level: 1, deployed: true },
      deployedTroops: [makeSiegeUnit({ state: 'dead', currentHp: 0 })],
    });

    expect(isBattleOver(state)).toBe(true);
  });
});
