import { createStarterVillage } from '../village-manager.ts';
import { canReloadDefenseAmmo, getBuildingAmmo, getReloadLabel, reloadDefenseAmmo } from '../defense-ammo.ts';
import type { PlacedBuilding, VillageState } from '../../types/village.ts';

function defense(buildingId: string, ammo: number, maxAmmo: number): PlacedBuilding {
  return {
    instanceId: buildingId.toLowerCase(), buildingId, buildingType: 'defense', level: 1,
    gridX: 1, gridY: 1, isUpgrading: false, upgradeTimeRemaining: 0, assignedBuilder: null,
    ammo, maxAmmo,
  };
}

function village(building: PlacedBuilding): VillageState {
  const base = createStarterVillage();
  return { ...base, resources: { ...base.resources, gold: 100, elixir: 20_000 }, buildings: [building] };
}

describe('defense ammunition reloads', () => {
  it('reloads Scattershot to 90 rounds for free and persists the magazine', () => {
    const state = village(defense('Scattershot', 3, 90));
    const reloaded = reloadDefenseAmmo(state, 'scattershot')!;
    expect(reloaded.resources).toEqual(state.resources);
    expect(getBuildingAmmo(reloaded.buildings[0]!)).toEqual({ ammo: 90, maxAmmo: 90 });
    expect(getReloadLabel('Scattershot')).toBe('Reload (Free)');
  });

  it('keeps the X-Bow elixir cost and refuses unaffordable or full reloads', () => {
    const state = village(defense('X-Bow', 10, 1000));
    const reloaded = reloadDefenseAmmo(state, 'x-bow')!;
    expect(reloaded.resources.elixir).toBe(10_000);
    expect(reloaded.buildings[0]!.ammo).toBe(1000);
    expect(canReloadDefenseAmmo({ ...state, resources: { ...state.resources, elixir: 9_999 } }, 'x-bow')).toBe(false);
    expect(reloadDefenseAmmo(reloaded, 'x-bow')).toBeNull();
  });

  it('rejects unknown buildings and missing instances', () => {
    const state = village(defense('Cannon', 0, 1));
    expect(canReloadDefenseAmmo(state, 'cannon')).toBe(false);
    expect(reloadDefenseAmmo(state, 'missing')).toBeNull();
  });
});
