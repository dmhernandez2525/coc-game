import {
  listLayoutPresets,
  saveLayoutPreset,
  loadLayoutPreset,
  deleteLayoutPreset,
  applyLayoutPreset,
  MAX_LAYOUT_PRESETS,
  type LayoutPreset,
} from '../layout-presets.ts';
import type { VillageState, PlacedBuilding, PlacedWall, PlacedTrap } from '../../types/village.ts';

function building(instanceId: string, gridX: number, gridY: number): PlacedBuilding {
  return {
    instanceId,
    buildingId: 'Cannon',
    buildingType: 'defense',
    level: 3,
    gridX,
    gridY,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

function wall(instanceId: string, gridX: number, gridY: number): PlacedWall {
  return { instanceId, level: 5, gridX, gridY };
}

function trap(instanceId: string, gridX: number, gridY: number): PlacedTrap {
  return { instanceId, trapId: 'Bomb', level: 1, gridX, gridY, isArmed: true };
}

function village(overrides: Partial<VillageState> = {}): VillageState {
  return {
    townHallLevel: 5,
    buildings: [building('bld_1', 10, 10)],
    walls: [wall('wall_1', 4, 4)],
    traps: [trap('trap_1', 6, 6)],
    resources: { gold: 999, elixir: 999, darkElixir: 0, gems: 100 },
    ...overrides,
  } as unknown as VillageState;
}

beforeEach(() => {
  localStorage.clear();
});

describe('saveLayoutPreset / listLayoutPresets / loadLayoutPreset', () => {
  it('saves a preset and lists its metadata', () => {
    const meta = saveLayoutPreset('Farm Base', village(), 'p1');
    expect(meta).not.toBeNull();
    expect(meta!.name).toBe('Farm Base');
    const list = listLayoutPresets();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('p1');
  });

  it('captures arrangement but not resources', () => {
    saveLayoutPreset('Base', village(), 'p1');
    const loaded = loadLayoutPreset('p1');
    expect(loaded).not.toBeNull();
    expect(loaded!.buildings).toEqual([{ instanceId: 'bld_1', gridX: 10, gridY: 10 }]);
    expect(loaded!.walls[0]!.gridX).toBe(4);
    expect(loaded!.traps[0]!.gridX).toBe(6);
    expect(loaded as unknown as Record<string, unknown>).not.toHaveProperty('resources');
  });

  it('falls back to "Layout" for a blank name', () => {
    const meta = saveLayoutPreset('   ', village(), 'p1');
    expect(meta!.name).toBe('Layout');
  });

  it('overwrites a preset when reusing its id without growing the index', () => {
    saveLayoutPreset('First', village(), 'p1');
    saveLayoutPreset('Second', village({ buildings: [building('bld_1', 20, 20)] }), 'p1');
    expect(listLayoutPresets()).toHaveLength(1);
    expect(loadLayoutPreset('p1')!.buildings[0]!.gridX).toBe(20);
    expect(loadLayoutPreset('p1')!.name).toBe('Second');
  });

  it('refuses to create more than MAX_LAYOUT_PRESETS new presets', () => {
    for (let i = 0; i < MAX_LAYOUT_PRESETS; i++) {
      expect(saveLayoutPreset(`P${i}`, village(), `p${i}`)).not.toBeNull();
    }
    expect(saveLayoutPreset('Overflow', village(), 'overflow')).toBeNull();
    expect(listLayoutPresets()).toHaveLength(MAX_LAYOUT_PRESETS);
  });

  it('returns null when loading an unknown id', () => {
    expect(loadLayoutPreset('missing')).toBeNull();
  });
});

describe('deleteLayoutPreset', () => {
  it('removes a saved preset', () => {
    saveLayoutPreset('Base', village(), 'p1');
    expect(deleteLayoutPreset('p1')).toBe(true);
    expect(listLayoutPresets()).toHaveLength(0);
    expect(loadLayoutPreset('p1')).toBeNull();
  });

  it('returns false for an unknown id', () => {
    expect(deleteLayoutPreset('missing')).toBe(false);
  });
});

describe('applyLayoutPreset', () => {
  const preset: LayoutPreset = {
    id: 'p1',
    name: 'Base',
    timestamp: 0,
    townHallLevel: 5,
    buildings: [{ instanceId: 'bld_1', gridX: 2, gridY: 3 }],
    walls: [wall('wall_1', 15, 15)],
    traps: [trap('trap_1', 18, 18)],
  };

  it('repositions matching instances without touching resources or levels', () => {
    const start = village();
    const result = applyLayoutPreset(start, preset);
    expect(result.buildings[0]!.gridX).toBe(2);
    expect(result.buildings[0]!.gridY).toBe(3);
    expect(result.buildings[0]!.level).toBe(3);
    expect(result.walls[0]!.gridX).toBe(15);
    expect(result.traps[0]!.gridX).toBe(18);
    expect(result.resources).toEqual(start.resources);
  });

  it('leaves instances absent from the preset in place', () => {
    const start = village({ buildings: [building('bld_1', 10, 10), building('bld_2', 30, 30)] });
    const result = applyLayoutPreset(start, preset);
    expect(result.buildings.find((b) => b.instanceId === 'bld_2')!.gridX).toBe(30);
  });

  it('does not mutate the input village', () => {
    const start = village();
    applyLayoutPreset(start, preset);
    expect(start.buildings[0]!.gridX).toBe(10);
  });
});
