export type ResourceType = 'Gold' | 'Elixir' | 'Dark Elixir' | 'Gold or Elixir';

export type DamageType = 'single' | 'splash' | 'chain' | 'multiple_targets';

export type TargetType = 'ground' | 'air' | 'ground_and_air' | 'ground_only' | 'all';

export type BuildingCategory =
  | 'defense'
  | 'resource_collector'
  | 'resource_storage'
  | 'army'
  | 'other'
  | 'trap';

export type TroopType = 'elixir' | 'dark_elixir';

export type SpellType = 'elixir' | 'dark_elixir';

export type EquipmentRarity = 'Common' | 'Epic' | 'Legendary';

export interface TileSize {
  width: number;
  height: number;
}

export interface BaseLevelStats {
  level: number;
  hp: number;
  upgradeCost: number;
  upgradeResource: ResourceType;
  upgradeTime: number;
  thRequired: number;
  xpGained?: number;
}

export function parseTileSize(raw: string): TileSize {
  const parts = raw.split('x');
  return { width: Number(parts[0]), height: Number(parts[1]) };
}
