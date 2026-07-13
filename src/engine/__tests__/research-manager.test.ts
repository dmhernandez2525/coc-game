import { createStarterVillage } from '../village-manager.ts';
import {
  canStartResearch,
  getResearchOption,
  getTroopResearchLevel,
  startResearch,
  tickResearch,
} from '../research-manager.ts';
import type { VillageState } from '../../types/village.ts';

function researchVillage(overrides: Partial<VillageState> = {}): VillageState {
  const base = createStarterVillage();
  return {
    ...base,
    townHallLevel: 12,
    resources: { ...base.resources, elixir: 20_000_000, darkElixir: 500_000 },
    buildings: [
      ...base.buildings,
      {
        instanceId: 'lab', buildingId: 'Laboratory', buildingType: 'army', level: 12,
        gridX: 10, gridY: 10, isUpgrading: false, upgradeTimeRemaining: 0, assignedBuilder: null,
      },
    ],
    ...overrides,
  };
}

describe('Laboratory research lifecycle', () => {
  it('deducts the exact resource and starts a persisted timed job without leveling instantly', () => {
    const state = researchVillage({ army: [{ name: 'Barbarian', level: 1, count: 4 }] });
    const option = getResearchOption(state, 'Barbarian')!;
    const started = startResearch(state, 'Barbarian')!;

    expect(started.resources[option.resource]).toBe(state.resources[option.resource] - option.cost);
    expect(started.activeResearch).toMatchObject({
      troopName: 'Barbarian', fromLevel: 1, targetLevel: 2,
      remainingTimeSeconds: option.timeSeconds,
    });
    expect(started.army[0]!.level).toBe(1);
  });

  it('allows only one job and enforces lab availability, level, and resources', () => {
    const ready = researchVillage();
    const started = startResearch(ready, 'Barbarian')!;
    expect(canStartResearch(started, 'Archer')).toBe(false);
    expect(startResearch(started, 'Archer')).toBeNull();

    const upgrading = researchVillage({
      buildings: ready.buildings.map((building) => (
        building.buildingId === 'Laboratory' ? { ...building, isUpgrading: true } : building
      )),
    });
    expect(canStartResearch(upgrading, 'Barbarian')).toBe(false);
    expect(canStartResearch(researchVillage({ resources: { ...ready.resources, elixir: 0 } }), 'Barbarian')).toBe(false);
  });

  it('counts down, completes once, and applies the level to trained and future troops', () => {
    const state = researchVillage({ army: [{ name: 'Barbarian', level: 1, count: 2 }] });
    const started = startResearch(state, 'Barbarian')!;
    const halfway = tickResearch(started, started.activeResearch!.totalTimeSeconds / 2);
    expect(halfway.activeResearch!.remainingTimeSeconds).toBe(started.activeResearch!.totalTimeSeconds / 2);
    expect(halfway.army[0]!.level).toBe(1);

    const completed = tickResearch(halfway, halfway.activeResearch!.remainingTimeSeconds);
    expect(completed.activeResearch).toBeNull();
    expect(completed.army[0]!.level).toBe(2);
    expect(getTroopResearchLevel(completed, 'Barbarian')).toBe(2);
    expect(tickResearch(completed, 999)).toBe(completed);
  });

  it('records completed research for an untrained troop', () => {
    const started = startResearch(researchVillage(), 'Archer')!;
    const completed = tickResearch(started, started.activeResearch!.remainingTimeSeconds);
    expect(completed.troopLevels?.Archer).toBe(2);
    expect(completed.army).toEqual([]);
  });
});
