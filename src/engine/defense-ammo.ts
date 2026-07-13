import type { PlacedBuilding, VillageState } from '../types/village.ts';

export interface DefenseAmmoProfile {
  maxAmmo: number;
  resource: 'elixir' | 'gold' | null;
  cost: number;
  meterLabel: string;
}

const PROFILES: Record<string, DefenseAmmoProfile> = {
  'X-Bow': { maxAmmo: 1000, resource: 'elixir', cost: 10_000, meterLabel: 'Elixir charge' },
  // Modern Scattershots reload automatically for free when the village is visited.
  Scattershot: { maxAmmo: 90, resource: null, cost: 0, meterLabel: 'Ammunition' },
};

export function getDefenseAmmoProfile(buildingId: string): DefenseAmmoProfile | null {
  return PROFILES[buildingId] ?? null;
}

export function getBuildingAmmo(building: PlacedBuilding): { ammo: number; maxAmmo: number } | null {
  const profile = getDefenseAmmoProfile(building.buildingId);
  if (!profile) return null;
  return {
    ammo: building.ammo ?? profile.maxAmmo,
    maxAmmo: building.maxAmmo ?? profile.maxAmmo,
  };
}

export function canReloadDefenseAmmo(state: VillageState, instanceId: string): boolean {
  const building = state.buildings.find((candidate) => candidate.instanceId === instanceId);
  if (!building) return false;
  const profile = getDefenseAmmoProfile(building.buildingId);
  const ammo = getBuildingAmmo(building);
  if (!profile || !ammo || ammo.ammo >= ammo.maxAmmo) return false;
  return profile.resource === null || state.resources[profile.resource] >= profile.cost;
}

export function reloadDefenseAmmo(state: VillageState, instanceId: string): VillageState | null {
  if (!canReloadDefenseAmmo(state, instanceId)) return null;
  const building = state.buildings.find((candidate) => candidate.instanceId === instanceId)!;
  const profile = getDefenseAmmoProfile(building.buildingId)!;
  const maxAmmo = building.maxAmmo ?? profile.maxAmmo;
  return {
    ...state,
    resources: profile.resource === null
      ? state.resources
      : { ...state.resources, [profile.resource]: state.resources[profile.resource] - profile.cost },
    buildings: state.buildings.map((candidate) => (
      candidate.instanceId === instanceId ? { ...candidate, ammo: maxAmmo, maxAmmo } : candidate
    )),
  };
}

export function getReloadLabel(buildingId: string): string {
  const profile = getDefenseAmmoProfile(buildingId);
  if (!profile) return 'Reload';
  if (profile.resource === null) return 'Reload (Free)';
  const resource = profile.resource === 'elixir' ? 'Elixir' : 'Gold';
  return `Reload, ${profile.cost.toLocaleString()} ${resource}`;
}
