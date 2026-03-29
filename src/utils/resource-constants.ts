import type { ResourceAmounts } from '../types/village.ts';

/** Maps display resource names to ResourceAmounts keys. */
export const RESOURCE_KEY_MAP: Record<string, keyof ResourceAmounts> = {
  Gold: 'gold',
  Elixir: 'elixir',
  'Dark Elixir': 'darkElixir',
};
