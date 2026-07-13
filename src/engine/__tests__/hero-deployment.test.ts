import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BattleState, BattleBuilding, DeployedTroop, ActiveDefense, DefenderCCState } from '../../types/battle.ts';
import type { PlacedBuilding } from '../../types/village.ts';
import type { OwnedHero } from '../../types/village.ts';
import {
  initBattleState,
  deployHeroToBattle,
  tickBattle,
  getBattleResult,
  isBattleOver,
} from '../battle-engine.ts';
import { applyPostBattleHeroRecovery } from '../hero-manager.ts';

// ---------------------------------------------------------------------------
// Determinism: pin randomness and clock so ids and offsets are stable
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacedBuilding(
  instanceId: string,
  buildingId: string,
  type: PlacedBuilding['buildingType'],
  overrides?: Partial<PlacedBuilding>,
): PlacedBuilding {
  return {
    instanceId,
    buildingId,
    buildingType: type,
    level: 1,
    gridX: 20,
    gridY: 20,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...overrides,
  };
}

function makeBuilding(name: string, overrides?: Partial<BattleBuilding>): BattleBuilding {
  return {
    instanceId: `bb_${name}`,
    name,
    currentHp: 500,
    maxHp: 500,
    x: 20,
    y: 20,
    isDestroyed: false,
    weight: name === 'Wall' ? 0 : 1,
    ...overrides,
  };
}

function makeTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  return {
    id: 'troop_atk_1',
    name: 'Barbarian',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 0,
    y: 0,
    targetId: null,
    state: 'idle',
    dps: 10,
    baseDps: 10,
    attackRange: 0.4,
    movementSpeed: 18,
    isFlying: false,
    ...overrides,
  };
}

function makeDefenderTroop(overrides?: Partial<DeployedTroop>): DeployedTroop {
  return makeTroop({ id: 'cc_def_Archer_1', name: 'Archer', attackRange: 3.5, isDefender: true, ...overrides });
}

function makeDefense(overrides?: Partial<ActiveDefense>): ActiveDefense {
  return {
    buildingInstanceId: 'def_cannon_1',
    name: 'Cannon',
    level: 1,
    currentHp: 400,
    maxHp: 400,
    x: 20,
    y: 20,
    targetTroopId: null,
    dps: 9,
    baseDps: 9,
    range: { min: 0, max: 9 },
    attackSpeed: 0.8,
    lastAttackTime: 0,
    isDestroyed: false,
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
    buildings: [makeBuilding('Town Hall'), makeBuilding('Gold Mine', { instanceId: 'bb_gm' })],
    spells: [],
    loot: { gold: 0, elixir: 0, darkElixir: 0 },
    availableTroops: [{ name: 'Barbarian', level: 1, count: 5 }],
    availableSpells: [],
    ...overrides,
  };
}

function makeOwnedHero(overrides?: Partial<OwnedHero>): OwnedHero {
  return {
    name: 'Barbarian King',
    level: 5,
    currentHp: 1595,
    isRecovering: false,
    recoveryTimeRemaining: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    equippedItems: [null, null],
    assignedPet: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// initBattleState with BattleInitOptions
// ---------------------------------------------------------------------------

describe('initBattleState - battle options', () => {
  it('populates availableHeroes from attackerHeroes with deployed false', () => {
    const state = initBattleState({ buildings: [] }, [], [], {
      attackerHeroes: [{ name: 'Barbarian King', level: 5 }, { name: 'Archer Queen', level: 5 }],
    });

    expect(state.availableHeroes).toEqual([
      { name: 'Barbarian King', level: 5, deployed: false },
      { name: 'Archer Queen', level: 5, deployed: false },
    ]);
  });

  it('defaults availableHeroes to an empty list when no options are given', () => {
    const state = initBattleState({ buildings: [] }, [], []);

    expect(state.availableHeroes).toEqual([]);
  });

  it('distributes availableLoot onto the buildings that hold each resource', () => {
    const buildings = [
      makePlacedBuilding('gs_1', 'Gold Storage', 'resource_storage'),
      makePlacedBuilding('es_1', 'Elixir Storage', 'resource_storage'),
      makePlacedBuilding('th_1', 'Town Hall', 'other'),
    ];
    const state = initBattleState({ buildings }, [], [], {
      availableLoot: { gold: 1000, elixir: 600, darkElixir: 0 },
    });

    const totals = state.buildings.reduce(
      (sum, b) => ({
        gold: sum.gold + (b.storedLoot?.gold ?? 0),
        elixir: sum.elixir + (b.storedLoot?.elixir ?? 0),
      }),
      { gold: 0, elixir: 0 },
    );
    expect(totals.gold).toBe(1000);
    expect(totals.elixir).toBe(600);
    const goldStorage = state.buildings.find((b) => b.instanceId === 'gs_1');
    expect(goldStorage!.storedLoot!.gold).toBeGreaterThan(0);
  });

  it('creates a defenderCC garrison when the base has a Clan Castle', () => {
    const buildings = [
      makePlacedBuilding('cc_1', 'Clan Castle', 'other', { gridX: 15, gridY: 17 }),
    ];
    const state = initBattleState({ buildings }, [], [], {
      defenderCastleTroops: [{ name: 'Archer', level: 1, count: 3 }],
    });

    expect(state.defenderCC).toEqual<DefenderCCState>({
      troops: [{ name: 'Archer', level: 1, count: 3 }],
      x: 15,
      y: 17,
      deployed: false,
    });
  });

  it('skips defenderCC when the base has no Clan Castle building', () => {
    const state = initBattleState({ buildings: [] }, [], [], {
      defenderCastleTroops: [{ name: 'Archer', level: 1, count: 3 }],
    });

    expect(state.defenderCC).toBeUndefined();
  });

  it('deploys defender heroes on the field as defender-owned units', () => {
    const state = initBattleState({ buildings: [] }, [], [], {
      defenderHeroes: [{ name: 'Barbarian King', level: 5, x: 22, y: 22 }],
    });

    expect(state.deployedTroops).toHaveLength(1);
    const king = state.deployedTroops[0]!;
    expect(king.name).toBe('Barbarian King');
    expect(king.isHero).toBe(true);
    expect(king.isDefender).toBe(true);
    expect(king.x).toBe(22);
    expect(king.y).toBe(22);
    expect(king.currentHp).toBe(1595);
  });
});

// ---------------------------------------------------------------------------
// deployHeroToBattle
// ---------------------------------------------------------------------------

describe('deployHeroToBattle', () => {
  it('deploys an available hero at the given position', () => {
    const state = makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    });
    const next = deployHeroToBattle(state, 'Barbarian King', 8, 12);

    expect(next).not.toBeNull();
    expect(next!.deployedTroops).toHaveLength(1);
    const hero = next!.deployedTroops[0]!;
    expect(hero.name).toBe('Barbarian King');
    expect(hero.isHero).toBe(true);
    expect(hero.heroAbilityUsed).toBe(false);
    expect(hero.x).toBe(8);
    expect(hero.y).toBe(12);
    expect(hero.currentHp).toBe(1595);
    expect(hero.dps).toBe(110);
  });

  it('marks the hero as deployed so it can only be deployed once per battle', () => {
    const state = makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    });
    const afterFirst = deployHeroToBattle(state, 'Barbarian King', 8, 12);

    expect(afterFirst!.availableHeroes![0]!.deployed).toBe(true);
    expect(deployHeroToBattle(afterFirst!, 'Barbarian King', 4, 4)).toBeNull();
  });

  it('returns null for a hero that is not in availableHeroes', () => {
    const state = makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    });

    expect(deployHeroToBattle(state, 'Archer Queen', 0, 0)).toBeNull();
  });

  it('returns null when the state has no availableHeroes list', () => {
    const state = makeBattleState();

    expect(deployHeroToBattle(state, 'Barbarian King', 0, 0)).toBeNull();
  });

  it('does not mutate the original state', () => {
    const state = makeBattleState({
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    });
    deployHeroToBattle(state, 'Barbarian King', 8, 12);

    expect(state.deployedTroops).toHaveLength(0);
    expect(state.availableHeroes![0]!.deployed).toBe(false);
  });

  it('redeploys recalled heroes and pets with their retained hitpoints', () => {
    const recalledHero = makeTroop({
      id: 'old_hero', name: 'Barbarian King', level: 5,
      isHero: true, currentHp: 600, maxHp: 1595,
    });
    const recalledPet = makeTroop({
      id: 'old_pet', name: 'Mighty Yak', level: 1,
      isPet: true, ownerHeroName: 'Barbarian King', currentHp: 700, maxHp: 3750,
    });
    const state = makeBattleState({
      availableHeroes: [{
        name: 'Barbarian King', level: 5, deployed: false,
        recalledTroop: recalledHero,
        pet: { name: 'Mighty Yak', level: 1, recalledTroop: recalledPet },
      }],
    });

    const next = deployHeroToBattle(state, 'Barbarian King', 8, 12)!;

    expect(next.deployedTroops.find((troop) => troop.isHero)?.currentHp).toBe(600);
    expect(next.deployedTroops.find((troop) => troop.isPet)?.currentHp).toBe(700);
    expect(next.availableHeroes?.[0]!.recalledTroop).toBeUndefined();
    expect(next.availableHeroes?.[0]!.pet?.recalledTroop).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// tickBattle: hero ability auto-activation
// ---------------------------------------------------------------------------

describe('tickBattle - hero ability activation', () => {
  function makeKing(overrides?: Partial<DeployedTroop>): DeployedTroop {
    return makeTroop({
      id: 'hero_Barbarian King_1',
      name: 'Barbarian King',
      level: 5,
      currentHp: 700,
      maxHp: 1595,
      dps: 110,
      baseDps: 110,
      attackRange: 1,
      movementSpeed: 16,
      isHero: true,
      heroAbilityUsed: false,
      x: 10,
      y: 10,
      ...overrides,
    });
  }

  it('fires Iron Fist when the king drops to half HP: heal, damage boost, summons', () => {
    const state = makeBattleState({ deployedTroops: [makeKing()] });
    const next = tickBattle(state, 50);

    const king = next.deployedTroops.find((t) => t.name === 'Barbarian King');
    expect(king).toBeDefined();
    expect(king!.heroAbilityUsed).toBe(true);
    // 700 + 500 ability HP recovery = 1200
    expect(king!.currentHp).toBe(1200);
    expect(king!.dps).toBe(110 + 56);
    // Iron Fist at ability level 1 summons 6 Barbarians (summonedBarbarians in heroes.json)
    const summons = next.deployedTroops.filter((t) => t.name === 'Barbarian' && t.id.includes('summon'));
    expect(summons).toHaveLength(6);
  });

  it('does not fire the ability while the hero is above the HP threshold', () => {
    const state = makeBattleState({ deployedTroops: [makeKing({ currentHp: 1500 })] });
    const next = tickBattle(state, 50);

    const king = next.deployedTroops.find((t) => t.name === 'Barbarian King');
    expect(king!.heroAbilityUsed).toBe(false);
    expect(next.deployedTroops.filter((t) => t.id.includes('summon'))).toHaveLength(0);
  });

  it('never fires the ability twice', () => {
    const state = makeBattleState({ deployedTroops: [makeKing()] });
    const afterFirst = tickBattle(state, 50);
    const afterSecond = tickBattle(afterFirst, 50);

    const summons = afterSecond.deployedTroops.filter((t) => t.id.includes('summon'));
    expect(summons).toHaveLength(6);
  });

  it('marks low-level heroes (no ability unlocked) as used without summoning', () => {
    const state = makeBattleState({
      deployedTroops: [makeKing({ level: 1, currentHp: 400, maxHp: 1445, dps: 102, baseDps: 102 })],
    });
    const next = tickBattle(state, 50);

    const king = next.deployedTroops.find((t) => t.name === 'Barbarian King');
    expect(king!.heroAbilityUsed).toBe(true);
    expect(king!.currentHp).toBe(400);
    expect(next.deployedTroops.filter((t) => t.id.includes('summon'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// tickBattle: defensive CC garrison deployment
// ---------------------------------------------------------------------------

describe('tickBattle - defensive clan castle troops', () => {
  const garrison: DefenderCCState = {
    troops: [{ name: 'Archer', level: 1, count: 2 }],
    x: 20,
    y: 20,
    deployed: false,
  };

  it('releases the garrison when an attacker enters the aggro radius', () => {
    const state = makeBattleState({
      deployedTroops: [makeTroop({ x: 15, y: 20 })],
      defenderCC: garrison,
    });
    const next = tickBattle(state, 50);

    const defenders = next.deployedTroops.filter((t) => t.isDefender);
    expect(defenders).toHaveLength(2);
    expect(defenders.every((t) => t.name === 'Archer')).toBe(true);
    expect(next.defenderCC!.deployed).toBe(true);
  });

  it('keeps the garrison inside while attackers stay far away', () => {
    const state = makeBattleState({
      deployedTroops: [makeTroop({ x: 0, y: 0 })],
      defenderCC: garrison,
    });
    const next = tickBattle(state, 50);

    expect(next.deployedTroops.filter((t) => t.isDefender)).toHaveLength(0);
    expect(next.defenderCC!.deployed).toBe(false);
  });

  it('does not deploy the garrison twice', () => {
    const state = makeBattleState({
      deployedTroops: [makeTroop({ x: 15, y: 20 })],
      defenderCC: garrison,
    });
    const afterFirst = tickBattle(state, 50);
    const afterSecond = tickBattle(afterFirst, 50);

    expect(afterSecond.deployedTroops.filter((t) => t.isDefender)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// tickBattle: troop-vs-troop combat
// ---------------------------------------------------------------------------

describe('tickBattle - troop vs troop combat', () => {
  it('attacker troop engages a nearby defender unit and damages it', () => {
    const attacker = makeTroop({ x: 10, y: 10, dps: 50, baseDps: 50 });
    const defender = makeDefenderTroop({ x: 10.2, y: 10, currentHp: 20, maxHp: 20 });
    const state = makeBattleState({ deployedTroops: [attacker, defender] });
    const next = tickBattle(state, 1000);

    const defenderAfter = next.deployedTroops.find((t) => t.isDefender);
    expect(defenderAfter!.currentHp).toBeLessThan(20);
    const attackerAfter = next.deployedTroops.find((t) => !t.isDefender);
    expect(attackerAfter!.targetId).toBe(defender.id);
  });

  it('defender unit fights back and can kill the attacker', () => {
    const attacker = makeTroop({ x: 10, y: 10, currentHp: 5, maxHp: 45, dps: 1, baseDps: 1 });
    const defender = makeDefenderTroop({ x: 10.2, y: 10, dps: 100, baseDps: 100 });
    const state = makeBattleState({ deployedTroops: [attacker, defender] });
    const next = tickBattle(state, 1000);

    const attackerAfter = next.deployedTroops.find((t) => !t.isDefender);
    expect(attackerAfter!.state).toBe('dead');
    expect(attackerAfter!.currentHp).toBe(0);
  });

  it('defender unit stays idle when no attacker is within aggro range', () => {
    const attacker = makeTroop({ x: 0, y: 0, targetId: 'bb_Town Hall' });
    const defender = makeDefenderTroop({ x: 30, y: 30 });
    const state = makeBattleState({ deployedTroops: [attacker, defender] });
    const next = tickBattle(state, 50);

    const defenderAfter = next.deployedTroops.find((t) => t.isDefender);
    expect(defenderAfter!.state).toBe('idle');
    expect(defenderAfter!.x).toBe(30);
    expect(defenderAfter!.y).toBe(30);
  });

  it('ground melee attacker ignores flying defender units and hits buildings instead', () => {
    const attacker = makeTroop({ x: 19.8, y: 20, dps: 50, baseDps: 50 });
    const flyingDefender = makeDefenderTroop({
      id: 'cc_def_Minion_1', name: 'Minion', x: 19.5, y: 20, isFlying: true,
    });
    const state = makeBattleState({ deployedTroops: [attacker, flyingDefender] });
    const next = tickBattle(state, 1000);

    const flyingAfter = next.deployedTroops.find((t) => t.isDefender);
    expect(flyingAfter!.currentHp).toBe(100);
    const attackerAfter = next.deployedTroops.find((t) => !t.isDefender);
    expect(attackerAfter!.targetId).not.toBe('cc_def_Minion_1');
  });

  it('troops with a favorite target (Giant) ignore defender units', () => {
    const giant = makeTroop({ id: 'troop_Giant_1', name: 'Giant', x: 10, y: 10, dps: 20, baseDps: 20 });
    const defender = makeDefenderTroop({ x: 10.5, y: 10 });
    const state = makeBattleState({ deployedTroops: [giant, defender] });
    const next = tickBattle(state, 50);

    const giantAfter = next.deployedTroops.find((t) => t.name === 'Giant');
    expect(giantAfter!.targetId).not.toBe(defender.id);
    const defenderAfter = next.deployedTroops.find((t) => t.isDefender);
    expect(defenderAfter!.currentHp).toBe(100);
  });

  it('defenses never target defender-owned units', () => {
    const defender = makeDefenderTroop({ x: 21, y: 20 });
    const cannon = makeDefense();
    const state = makeBattleState({
      deployedTroops: [defender],
      defenses: [cannon],
      buildings: [makeBuilding('Cannon', { instanceId: 'def_cannon_1' })],
      availableTroops: [{ name: 'Barbarian', level: 1, count: 1 }],
    });
    const next = tickBattle(state, 1000);

    expect(next.defenses[0]!.targetTroopId).toBeNull();
    expect(next.deployedTroops[0]!.currentHp).toBe(100);
  });

  it('living defender units do not keep the battle running once all attackers fall', () => {
    const deadAttacker = makeTroop({ state: 'dead', currentHp: 0 });
    const defender = makeDefenderTroop();
    const state = makeBattleState({
      deployedTroops: [deadAttacker, defender],
      availableTroops: [],
    });
    const next = tickBattle(state, 50);

    expect(next.phase).toBe('ended');
    expect(isBattleOver(next)).toBe(true);
  });

  it('battle stays active while the attacker still has an undeployed hero', () => {
    const state = makeBattleState({
      deployedTroops: [],
      availableTroops: [],
      availableHeroes: [{ name: 'Barbarian King', level: 5, deployed: false }],
    });
    const next = tickBattle(state, 50);

    expect(next.phase).toBe('active');
    expect(isBattleOver(next)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Loot award through the battle result
// ---------------------------------------------------------------------------

describe('battle loot award', () => {
  it('credits stored loot when the holding building is destroyed', () => {
    const storage = makeBuilding('Gold Storage', {
      instanceId: 'bb_gs',
      currentHp: 10,
      storedLoot: { gold: 800, elixir: 0, darkElixir: 0 },
    });
    const attacker = makeTroop({ x: 20, y: 19.8, dps: 500, baseDps: 500, targetId: 'bb_gs' });
    const state = makeBattleState({
      deployedTroops: [attacker],
      buildings: [makeBuilding('Town Hall'), storage],
    });
    const next = tickBattle(state, 1000);

    const storageAfter = next.buildings.find((b) => b.instanceId === 'bb_gs');
    expect(storageAfter!.isDestroyed).toBe(true);
    expect(next.loot.gold).toBe(800);
    expect(storageAfter!.storedLoot).toBeUndefined();
  });

  it('only awards a building\'s loot once', () => {
    const storage = makeBuilding('Gold Storage', {
      instanceId: 'bb_gs',
      isDestroyed: true,
      currentHp: 0,
      storedLoot: { gold: 800, elixir: 0, darkElixir: 0 },
    });
    const state = makeBattleState({
      deployedTroops: [makeTroop()],
      buildings: [makeBuilding('Town Hall'), storage],
    });
    const afterFirst = tickBattle(state, 50);
    const afterSecond = tickBattle(afterFirst, 50);

    expect(afterFirst.loot.gold).toBe(800);
    expect(afterSecond.loot.gold).toBe(800);
  });

  it('carries earned loot into the battle result for the result screen', () => {
    const state = makeBattleState({ loot: { gold: 1200, elixir: 900, darkElixir: 25 }, stars: 2 });
    const result = getBattleResult(state, 30);

    expect(result.loot).toEqual({ gold: 1200, elixir: 900, darkElixir: 25 });
    expect(result.trophyChange).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// getBattleResult: hero status for post-battle recovery
// ---------------------------------------------------------------------------

describe('getBattleResult - heroesDeployed', () => {
  it('reports each deployed attacker hero with its remaining HP', () => {
    const king = makeTroop({
      id: 'hero_Barbarian King_1', name: 'Barbarian King', level: 5,
      currentHp: 640, maxHp: 1595, isHero: true,
    });
    const state = makeBattleState({ deployedTroops: [king] });
    const result = getBattleResult(state, 10);

    expect(result.heroesDeployed).toEqual([
      { name: 'Barbarian King', level: 5, remainingHp: 640 },
    ]);
  });

  it('reports 0 HP for heroes that died in battle', () => {
    const king = makeTroop({
      id: 'hero_Barbarian King_1', name: 'Barbarian King', level: 5,
      currentHp: 0, maxHp: 1595, isHero: true, state: 'dead',
    });
    const state = makeBattleState({ deployedTroops: [king] });
    const result = getBattleResult(state, 10);

    expect(result.heroesDeployed).toEqual([
      { name: 'Barbarian King', level: 5, remainingHp: 0 },
    ]);
  });

  it('excludes defender heroes and omits the field when no heroes fought', () => {
    const defenderKing = makeTroop({
      id: 'hero_def_Barbarian King_1', name: 'Barbarian King', level: 5,
      isHero: true, isDefender: true,
    });
    const state = makeBattleState({ deployedTroops: [defenderKing, makeTroop()] });
    const result = getBattleResult(state, 10);

    expect(result.heroesDeployed).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyPostBattleHeroRecovery
// ---------------------------------------------------------------------------

describe('applyPostBattleHeroRecovery', () => {
  it('puts a damaged hero into recovery proportional to missing HP', () => {
    const heroes = [makeOwnedHero()];
    // Half HP missing at level 5: regen 720s, so 360s of recovery
    const updated = applyPostBattleHeroRecovery(heroes, [
      { name: 'Barbarian King', level: 5, remainingHp: 797.5 },
    ]);

    expect(updated[0]!.isRecovering).toBe(true);
    expect(updated[0]!.currentHp).toBe(797.5);
    expect(updated[0]!.recoveryTimeRemaining).toBe(360);
  });

  it('gives a dead hero the full regeneration time', () => {
    const heroes = [makeOwnedHero()];
    const updated = applyPostBattleHeroRecovery(heroes, [
      { name: 'Barbarian King', level: 5, remainingHp: 0 },
    ]);

    expect(updated[0]!.isRecovering).toBe(true);
    expect(updated[0]!.recoveryTimeRemaining).toBe(720);
  });

  it('leaves an unhurt hero available with full HP', () => {
    const heroes = [makeOwnedHero()];
    const updated = applyPostBattleHeroRecovery(heroes, [
      { name: 'Barbarian King', level: 5, remainingHp: 1595 },
    ]);

    expect(updated[0]!.isRecovering).toBe(false);
    expect(updated[0]!.recoveryTimeRemaining).toBe(0);
    expect(updated[0]!.currentHp).toBe(1595);
  });

  it('does not touch heroes that were not deployed', () => {
    const heroes = [makeOwnedHero(), makeOwnedHero({ name: 'Archer Queen', currentHp: 630 })];
    const updated = applyPostBattleHeroRecovery(heroes, [
      { name: 'Barbarian King', level: 5, remainingHp: 0 },
    ]);

    expect(updated[1]).toBe(heroes[1]);
  });
});
