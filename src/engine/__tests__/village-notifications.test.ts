import { diffVillageNotifications } from '../village-notifications.ts';
import type {
  VillageState,
  PlacedBuilding,
  BuilderSlot,
  ResourceAmounts,
} from '../../types/village.ts';

function building(instanceId: string, level: number): PlacedBuilding {
  return {
    instanceId,
    buildingId: 'Cannon',
    buildingType: 'defense',
    level,
    gridX: 0,
    gridY: 0,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
  };
}

function builder(id: number, assignedTo: string | null, isUnlocked = true): BuilderSlot {
  return { id, isUnlocked, assignedTo, timeRemaining: 0 };
}

function village(overrides: Partial<VillageState> = {}): VillageState {
  return {
    buildings: [building('bld_1', 2)],
    builders: [builder(1, null)],
    resources: { gold: 100, elixir: 100, darkElixir: 0, gems: 0 },
    ...overrides,
  } as unknown as VillageState;
}

const caps: ResourceAmounts = { gold: 1000, elixir: 1000, darkElixir: 500, gems: Infinity };

describe('diffVillageNotifications', () => {
  it('returns no events when nothing changed', () => {
    const v = village();
    expect(diffVillageNotifications(v, v, caps)).toEqual([]);
  });

  it('emits a success event when a building levels up', () => {
    const prev = village();
    const next = village({ buildings: [building('bld_1', 3)] });
    const events = diffVillageNotifications(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('success');
    expect(events[0]!.message).toContain('level 3');
  });

  it('ignores a building that was not present before', () => {
    const prev = village({ buildings: [] });
    const next = village({ buildings: [building('bld_1', 1)] });
    expect(diffVillageNotifications(prev, next)).toEqual([]);
  });

  it('emits an info event when a builder frees up', () => {
    const prev = village({ builders: [builder(1, 'bld_1')] });
    const next = village({ builders: [builder(1, null)] });
    const events = diffVillageNotifications(prev, next);
    expect(events.some((e) => e.kind === 'info' && e.message === 'Builder available!')).toBe(true);
  });

  it('does not emit a builder event when a builder becomes busy', () => {
    const prev = village({ builders: [builder(1, null)] });
    const next = village({ builders: [builder(1, 'bld_1')] });
    expect(diffVillageNotifications(prev, next)).toEqual([]);
  });

  it('emits a warning when a resource reaches its cap', () => {
    const prev = village({ resources: { gold: 900, elixir: 100, darkElixir: 0, gems: 0 } });
    const next = village({ resources: { gold: 1000, elixir: 100, darkElixir: 0, gems: 0 } });
    const events = diffVillageNotifications(prev, next, caps);
    expect(events.some((e) => e.kind === 'warning' && e.message === 'Gold storage full')).toBe(true);
  });

  it('does not re-warn when storage was already full', () => {
    const prev = village({ resources: { gold: 1000, elixir: 100, darkElixir: 0, gems: 0 } });
    const next = village({ resources: { gold: 1000, elixir: 100, darkElixir: 0, gems: 0 } });
    expect(diffVillageNotifications(prev, next, caps)).toEqual([]);
  });

  it('skips storage detection when caps are omitted', () => {
    const prev = village({ resources: { gold: 900, elixir: 100, darkElixir: 0, gems: 0 } });
    const next = village({ resources: { gold: 1000, elixir: 100, darkElixir: 0, gems: 0 } });
    expect(diffVillageNotifications(prev, next)).toEqual([]);
  });
});
