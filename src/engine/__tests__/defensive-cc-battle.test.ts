// Battle engine integration for the DEFENDING clan castle garrison: it must
// deploy when attackers close on the Clan Castle, then fight those attackers
// through troop-vs-troop combat (never buildings). Math.random is pinned so
// garrison offsets are deterministic.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PlacedBuilding } from '../../types/village.ts';
import { initBattleState, deployTroop, tickBattle } from '../battle-engine.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GARRISON = [{ name: 'Archer', level: 1, count: 5 }];

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

/** A defender base whose Clan Castle sits away from the Town Hall. */
function makeDefender() {
  return {
    buildings: [
      makePlacedBuilding('Clan Castle', 'army', 10, 10),
      makePlacedBuilding('Town Hall', 'other', 30, 30),
    ],
  };
}

/** Tick the battle repeatedly with a fixed step. */
function runTicks(state: ReturnType<typeof initBattleState>, count: number, stepMs = 500) {
  let next = state;
  for (let i = 0; i < count; i++) next = tickBattle(next, stepMs);
  return next;
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Garrison release gating
// ---------------------------------------------------------------------------

describe('defender clan castle release', () => {
  it('stages the garrison at the Clan Castle building, undeployed', () => {
    const state = initBattleState(makeDefender(), [{ name: 'Giant', level: 1, count: 1 }], [], {
      defenderCastleTroops: GARRISON,
    });

    expect(state.defenderCC).toEqual({ troops: GARRISON, x: 10, y: 10, deployed: false });
  });

  it('releases the garrison once an attacker closes on the Clan Castle', () => {
    const state = initBattleState(makeDefender(), [{ name: 'Giant', level: 1, count: 1 }], [], {
      defenderCastleTroops: GARRISON,
    });
    const withAttacker = deployTroop(state, 'Giant', 10, 10);
    expect(withAttacker).not.toBeNull();

    const after = tickBattle(withAttacker!, 500);

    expect(after.defenderCC?.deployed).toBe(true);
    const defenders = after.deployedTroops.filter((t) => t.isDefender);
    expect(defenders).toHaveLength(5);
    for (const d of defenders) {
      expect(d.id).toMatch(/^cc_def_Archer_/);
    }
  });

  it('keeps the garrison home while attackers stay out of aggro range', () => {
    const state = initBattleState(makeDefender(), [{ name: 'Giant', level: 1, count: 1 }], [], {
      defenderCastleTroops: GARRISON,
    });
    // Drop the Giant on the Town Hall, far from the Clan Castle at (10, 10).
    const withAttacker = deployTroop(state, 'Giant', 30, 30);

    const after = runTicks(withAttacker!, 3);

    expect(after.defenderCC?.deployed).toBe(false);
    expect(after.deployedTroops.some((t) => t.isDefender)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Troop-vs-troop combat (the defensive garrison must actually fight)
// ---------------------------------------------------------------------------

describe('defender garrison combat', () => {
  it('damages the attacker it deployed against', () => {
    const state = initBattleState(makeDefender(), [{ name: 'Giant', level: 1, count: 1 }], [], {
      defenderCastleTroops: GARRISON,
    });
    const withAttacker = deployTroop(state, 'Giant', 10, 10);

    const after = runTicks(withAttacker!, 12);

    const giant = after.deployedTroops.find((t) => t.name === 'Giant' && !t.isDefender);
    expect(giant).toBeDefined();
    // Five archers at 7 dps each chip the 300 HP Giant well below full.
    expect(giant!.currentHp).toBeLessThan(300);
  });

  it('lets a full garrison overwhelm and kill a lone Barbarian', () => {
    const state = initBattleState(makeDefender(), [{ name: 'Barbarian', level: 1, count: 1 }], [], {
      defenderCastleTroops: GARRISON,
    });
    const withAttacker = deployTroop(state, 'Barbarian', 10, 10);

    const after = runTicks(withAttacker!, 12);

    const barb = after.deployedTroops.find((t) => t.name === 'Barbarian' && !t.isDefender);
    expect(barb!.state).toBe('dead');
  });

  it('never lets defender troops target buildings', () => {
    const state = initBattleState(makeDefender(), [{ name: 'Giant', level: 1, count: 1 }], [], {
      defenderCastleTroops: GARRISON,
    });
    const withAttacker = deployTroop(state, 'Giant', 10, 10);

    const after = runTicks(withAttacker!, 12);

    const buildingIds = new Set(after.buildings.map((b) => b.instanceId));
    for (const d of after.deployedTroops.filter((t) => t.isDefender)) {
      if (d.targetId === null) continue;
      expect(buildingIds.has(d.targetId)).toBe(false);
      expect(d.targetId).toMatch(/^troop_/);
    }
  });
});
