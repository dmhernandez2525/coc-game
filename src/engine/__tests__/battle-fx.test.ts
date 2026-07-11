import {
  advanceFx,
  spawnBattleFx,
  diffDefenseFires,
  diffTroopDeaths,
  fxProgress,
  projectileColorFor,
  createProjectile,
  PROJECTILE_DURATION_MS,
  DEATH_DURATION_MS,
  type BattleFx,
} from '../battle-fx.ts';
import type { ActiveDefense, DeployedTroop } from '../../types/battle.ts';

function defense(overrides: Partial<ActiveDefense>): ActiveDefense {
  return {
    buildingInstanceId: 'd1',
    name: 'Cannon',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    x: 5,
    y: 5,
    targetTroopId: 't1',
    dps: 10,
    baseDps: 10,
    range: { min: 0, max: 9 },
    attackSpeed: 1,
    lastAttackTime: 0,
    isDestroyed: false,
    ...overrides,
  };
}

function troop(overrides: Partial<DeployedTroop>): DeployedTroop {
  return {
    id: 't1',
    name: 'Barbarian',
    level: 1,
    currentHp: 50,
    maxHp: 50,
    x: 8,
    y: 8,
    targetId: null,
    state: 'moving',
    dps: 8,
    baseDps: 8,
    attackRange: 1,
    movementSpeed: 16,
    isFlying: false,
    ...overrides,
  };
}

describe('projectileColorFor', () => {
  it('returns a known colour for a listed defence', () => {
    expect(projectileColorFor('Mortar')).toBe('#f97316');
  });
  it('falls back for an unknown defence', () => {
    expect(projectileColorFor('Mystery Tower')).toBe('#fde68a');
  });
});

describe('fxProgress', () => {
  it('is 0 at spawn and 1 at completion', () => {
    const p = createProjectile('p', { x: 0, y: 0 }, { x: 1, y: 1 }, '#fff');
    expect(fxProgress(p)).toBe(0);
    expect(fxProgress({ ...p, elapsed: p.duration })).toBe(1);
  });
  it('clamps overshoot to 1', () => {
    const p = createProjectile('p', { x: 0, y: 0 }, { x: 1, y: 1 }, '#fff');
    expect(fxProgress({ ...p, elapsed: p.duration * 2 })).toBe(1);
  });
});

describe('diffDefenseFires', () => {
  it('detects a defence whose lastAttackTime advanced', () => {
    const prev = [defense({ lastAttackTime: 1 })];
    const next = [defense({ lastAttackTime: 2 })];
    expect(diffDefenseFires(prev, next)).toHaveLength(1);
  });
  it('ignores a defence that did not fire', () => {
    const prev = [defense({ lastAttackTime: 2 })];
    const next = [defense({ lastAttackTime: 2 })];
    expect(diffDefenseFires(prev, next)).toHaveLength(0);
  });
  it('ignores a destroyed or targetless defence', () => {
    const prev = [defense({ lastAttackTime: 1 })];
    expect(diffDefenseFires(prev, [defense({ lastAttackTime: 2, isDestroyed: true })])).toHaveLength(0);
    expect(diffDefenseFires(prev, [defense({ lastAttackTime: 2, targetTroopId: null })])).toHaveLength(0);
  });
});

describe('diffTroopDeaths', () => {
  it('detects a troop that just died', () => {
    const prev = [troop({ state: 'moving' })];
    const next = [troop({ state: 'dead' })];
    expect(diffTroopDeaths(prev, next)).toHaveLength(1);
  });
  it('does not re-report an already dead troop', () => {
    const prev = [troop({ state: 'dead' })];
    const next = [troop({ state: 'dead' })];
    expect(diffTroopDeaths(prev, next)).toHaveLength(0);
  });
});

describe('spawnBattleFx', () => {
  it('spawns a projectile from a firing defence to its target', () => {
    const prev = { defenses: [defense({ lastAttackTime: 0 })], troops: [troop({})] };
    const next = { defenses: [defense({ lastAttackTime: 1 })], troops: [troop({ x: 8, y: 9 })] };
    const fx = spawnBattleFx(prev, next, 0);
    const projectile = fx.find((f) => f.kind === 'projectile');
    expect(projectile).toBeDefined();
    expect(projectile).toMatchObject({ x1: 5, y1: 5, x2: 8, y2: 9, color: '#fbbf24' });
  });

  it('spawns a death puff for a troop that died', () => {
    const prev = { defenses: [], troops: [troop({ state: 'moving' })] };
    const next = { defenses: [], troops: [troop({ state: 'dead', x: 3, y: 4 })] };
    const fx = spawnBattleFx(prev, next, 0);
    const puff = fx.find((f) => f.kind === 'death');
    expect(puff).toMatchObject({ x: 3, y: 4 });
  });

  it('produces deterministic ids from the sequence seed', () => {
    const prev = { defenses: [defense({ lastAttackTime: 0 })], troops: [troop({})] };
    const next = { defenses: [defense({ lastAttackTime: 1 })], troops: [troop({})] };
    expect(spawnBattleFx(prev, next, 10)[0]!.id).toBe('proj_11');
  });

  it('skips a projectile when the target troop is gone', () => {
    const prev = { defenses: [defense({ lastAttackTime: 0 })], troops: [troop({})] };
    const next = { defenses: [defense({ lastAttackTime: 1, targetTroopId: 'gone' })], troops: [] };
    expect(spawnBattleFx(prev, next, 0)).toHaveLength(0);
  });
});

describe('advanceFx', () => {
  it('returns the same empty reference unchanged', () => {
    const empty: BattleFx[] = [];
    expect(advanceFx(empty, 50)).toBe(empty);
  });

  it('advances elapsed time', () => {
    const fx = [createProjectile('p', { x: 0, y: 0 }, { x: 1, y: 1 }, '#fff')];
    expect(advanceFx(fx, 50)[0]!.elapsed).toBe(50);
  });

  it('drops effects that reach their duration', () => {
    const fx = [createProjectile('p', { x: 0, y: 0 }, { x: 1, y: 1 }, '#fff')];
    expect(advanceFx(fx, PROJECTILE_DURATION_MS)).toHaveLength(0);
  });

  it('keeps a death puff until its longer lifetime elapses', () => {
    const fx: BattleFx[] = [
      { id: 'd', kind: 'death', x: 0, y: 0, elapsed: 0, duration: DEATH_DURATION_MS, color: '#fff' },
    ];
    expect(advanceFx(fx, DEATH_DURATION_MS - 10)).toHaveLength(1);
  });
});
