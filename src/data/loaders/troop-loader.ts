import type { TroopData } from '../../types';
import elixirTroopsJson from '../elixir_troops.json';
import darkElixirTroopsJson from '../dark_elixir_troops.json';

// Normalize favoriteTarget: convert "None" string to null
function normalizeTroop(troop: TroopData): TroopData {
  return {
    ...troop,
    favoriteTarget: troop.favoriteTarget === 'None' ? null : troop.favoriteTarget,
  };
}

// Elixir troops come as an object-map, normalize favoriteTarget
const rawElixirTroops = elixirTroopsJson as unknown as Record<string, TroopData>;
export const elixirTroops: Record<string, TroopData> = Object.fromEntries(
  Object.entries(rawElixirTroops).map(([key, troop]) => [key, normalizeTroop(troop)]),
);

// Dark elixir troops come as an array; normalize to Record and fix favoriteTarget
const rawDarkTroopsArray = darkElixirTroopsJson as unknown as TroopData[];
export const darkElixirTroops: Record<string, TroopData> = Object.fromEntries(
  rawDarkTroopsArray.map((troop) => [troop.name, normalizeTroop(troop)]),
);

export function getTroop(name: string): TroopData | undefined {
  return elixirTroops[name] ?? darkElixirTroops[name];
}

export function getAllTroops(): TroopData[] {
  return [...Object.values(elixirTroops), ...Object.values(darkElixirTroops)];
}
