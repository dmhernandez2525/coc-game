import type { BattleState, DeployedTroop } from '../../types/battle.ts';
import type { PlacedBuilding, PlacedTrap, VillageState } from '../../types/village.ts';
import { createStarterVillage } from '../village-manager.ts';
import { simulateDefense, triggerDefenseTraps } from '../defense-simulator.ts';

function makeTroop(overrides: Partial<DeployedTroop> = {}): DeployedTroop {
  return {
    id: 'attacker_1',
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 5,
    y: 5,
    targetId: null,
    state: 'idle',
    dps: 10,
    baseDps: 10,
    attackRange: 0.4,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

function makeBattle(troops: DeployedTroop[]): BattleState {
  return {
    phase: 'active',
    timeRemaining: 180,
    destructionPercent: 0,
    stars: 0,
    deployedTroops: troops,
    defenses: [],
    buildings: [],
    spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: [],
    availableSpells: [],
  };
}

function makeTrap(trapId: string, overrides: Partial<PlacedTrap> = {}): PlacedTrap {
  return {
    instanceId: `trap_${trapId}`,
    trapId,
    level: 1,
    gridX: 5,
    gridY: 5,
    isArmed: true,
    ...overrides,
  };
}

function makeBuilding(
  instanceId: string,
  buildingId: string,
  buildingType: PlacedBuilding['buildingType'],
  x: number,
  y: number,
): PlacedBuilding {
  return {
    instanceId,
    buildingId,
    buildingType,
    level: 1,
    gridX: x,
    gridY: y,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

describe('triggerDefenseTraps', () => {
  it('fires an armed bomb, damages ground attackers, and disarms it', () => {
    const result = triggerDefenseTraps(makeBattle([makeTroop()]), [makeTrap('Bomb')]);

    expect(result.triggered).toEqual(['Bomb']);
    expect(result.traps[0]!.isArmed).toBe(false);
    expect(result.battle.deployedTroops[0]!.currentHp).toBe(80);
  });

  it('does not let an air-only trap target a ground troop', () => {
    const result = triggerDefenseTraps(makeBattle([makeTroop()]), [makeTrap('Air Bomb')]);

    expect(result.triggered).toEqual([]);
    expect(result.traps[0]!.isArmed).toBe(true);
    expect(result.battle.deployedTroops[0]!.currentHp).toBe(100);
  });

  it('launches a low-housing troop with a Spring Trap', () => {
    const result = triggerDefenseTraps(makeBattle([makeTroop()]), [makeTrap('Spring Trap')]);

    expect(result.battle.deployedTroops[0]!.state).toBe('dead');
    expect(result.battle.deployedTroops[0]!.currentHp).toBe(0);
  });

  it('spawns defender skeletons from a Skeleton Trap', () => {
    const result = triggerDefenseTraps(makeBattle([makeTroop()]), [makeTrap('Skeleton Trap')]);

    const skeletons = result.battle.deployedTroops.filter((troop) => troop.name === 'Skeleton');
    expect(skeletons).toHaveLength(2);
    expect(skeletons.every((troop) => troop.isDefender)).toBe(true);
  });
});

describe('simulateDefense', () => {
  function villageWithDefense(): VillageState {
    return {
      ...createStarterVillage(),
      townHallLevel: 10,
      buildings: [
        makeBuilding('town_hall', 'Town Hall', 'other', 20, 20),
        makeBuilding('xbow', 'X-Bow', 'defense', 21, 20),
      ],
      traps: [makeTrap('Bomb', { gridX: 20.5, gridY: 17 })],
      resources: { gold: 100_000, elixir: 100_000, darkElixir: 10_000, gems: 0 },
      trophies: 500,
    };
  }

  it('persists a defense log, fired traps, statistics, and defense ammo', () => {
    const result = simulateDefense(villageWithDefense(), {
      now: 123456,
      attackerName: 'Test Raider',
      attackerArmy: [{ name: 'Barbarian', level: 1, count: 8 }],
    });

    expect(result.entry.id).toBe('defense_123456');
    expect(result.entry.attackerName).toBe('Test Raider');
    expect(result.entry.trapsTriggered).toContain('Bomb');
    expect(result.village.defenseLog?.[0]).toEqual(result.entry);
    expect(result.village.lastDefenseAt).toBe(123456);
    expect(result.village.statistics?.totalDefenses).toBe(1);
    expect(result.village.traps[0]!.isArmed).toBe(false);
    expect(result.village.buildings.find((building) => building.instanceId === 'xbow')!.ammo)
      .toBeLessThan(1000);
  });

  it('caps the persisted log to the most recent 20 defenses', () => {
    const village = villageWithDefense();
    const first = simulateDefense(village, {
      now: 1,
      attackerArmy: [{ name: 'Barbarian', level: 1, count: 1 }],
    }).entry;
    village.defenseLog = Array.from({ length: 20 }, (_, index) => ({
      ...first,
      id: `old_${index}`,
      timestamp: index,
    }));

    const result = simulateDefense(village, {
      now: 999,
      attackerArmy: [{ name: 'Barbarian', level: 1, count: 1 }],
    });

    expect(result.village.defenseLog).toHaveLength(20);
    expect(result.village.defenseLog?.[0]!.id).toBe('defense_999');
    expect(result.village.defenseLog?.some((entry) => entry.id === 'old_19')).toBe(false);
  });
});
