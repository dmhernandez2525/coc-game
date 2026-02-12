import type { SpellData } from '../../types';
import elixirSpellsJson from '../elixir_spells.json';
import darkSpellsJson from '../dark_spells.json';

export const elixirSpells = elixirSpellsJson as SpellData[];
export const darkSpells = darkSpellsJson as SpellData[];

export function getSpell(name: string): SpellData | undefined {
  return (
    elixirSpells.find((s) => s.name === name) ??
    darkSpells.find((s) => s.name === name)
  );
}

export function getAllSpells(): SpellData[] {
  return [...elixirSpells, ...darkSpells];
}
