// Named village-layout presets stored in localStorage. A preset captures only
// the ARRANGEMENT (building/wall/trap coordinates), never resources or upgrade
// progress, so switching layouts never rolls a player's economy backward the
// way a full save/load would. Applying a preset repositions the matching
// instances and leaves everything else untouched.

import type { VillageState, PlacedWall, PlacedTrap } from '../types/village.ts';

const PRESET_KEY_PREFIX = 'coc_layout_';
const INDEX_KEY = 'coc_layouts_index';

/** Most presets a player can keep at once. */
export const MAX_LAYOUT_PRESETS = 8;

export interface LayoutPresetMeta {
  id: string;
  name: string;
  timestamp: number;
  townHallLevel: number;
}

interface BuildingPlacement {
  instanceId: string;
  gridX: number;
  gridY: number;
}

export interface LayoutPreset extends LayoutPresetMeta {
  buildings: BuildingPlacement[];
  walls: PlacedWall[];
  traps: PlacedTrap[];
}

function storageKey(id: string): string {
  return `${PRESET_KEY_PREFIX}${id}`;
}

function loadIndex(): LayoutPresetMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LayoutPresetMeta[]) : [];
  } catch {
    return [];
  }
}

function saveIndex(metas: LayoutPresetMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
}

/** List saved layout presets, newest first. */
export function listLayoutPresets(): LayoutPresetMeta[] {
  return [...loadIndex()].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Capture the current village arrangement under the given name. Returns the new
 * preset's metadata, or null when storage fails or the preset cap is reached.
 * An id may be supplied to overwrite an existing preset in place.
 */
export function saveLayoutPreset(
  name: string,
  village: VillageState,
  id: string = `layout_${String(Date.now())}`,
): LayoutPresetMeta | null {
  const index = loadIndex();
  const isNew = !index.some((m) => m.id === id);
  if (isNew && index.length >= MAX_LAYOUT_PRESETS) return null;

  const preset: LayoutPreset = {
    id,
    name: name.trim() || 'Layout',
    timestamp: Date.now(),
    townHallLevel: village.townHallLevel,
    buildings: village.buildings.map((b) => ({
      instanceId: b.instanceId,
      gridX: b.gridX,
      gridY: b.gridY,
    })),
    walls: village.walls.map((w) => ({ ...w })),
    traps: (village.traps ?? []).map((t) => ({ ...t })),
  };

  try {
    localStorage.setItem(storageKey(id), JSON.stringify(preset));
  } catch {
    return null;
  }

  const meta: LayoutPresetMeta = {
    id,
    name: preset.name,
    timestamp: preset.timestamp,
    townHallLevel: preset.townHallLevel,
  };
  const nextIndex = isNew
    ? [...index, meta]
    : index.map((m) => (m.id === id ? meta : m));
  saveIndex(nextIndex);
  return meta;
}

/** Load a full preset by id, or null when it is missing or corrupt. */
export function loadLayoutPreset(id: string): LayoutPreset | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LayoutPreset;
    if (!Array.isArray(parsed.buildings)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Delete a preset by id. Returns false when it did not exist. */
export function deleteLayoutPreset(id: string): boolean {
  if (localStorage.getItem(storageKey(id)) === null) return false;
  localStorage.removeItem(storageKey(id));
  saveIndex(loadIndex().filter((m) => m.id !== id));
  return true;
}

/**
 * Return a village with its buildings, walls, and traps repositioned to match
 * the preset. Only instances present in BOTH the village and the preset move;
 * anything else keeps its current position. Resources, levels, and upgrade
 * state are never touched. Pure: returns a new village, never mutates.
 */
export function applyLayoutPreset(
  village: VillageState,
  preset: LayoutPreset,
): VillageState {
  const buildingPos = new Map(preset.buildings.map((b) => [b.instanceId, b]));
  const wallPos = new Map(preset.walls.map((w) => [w.instanceId, w]));
  const trapPos = new Map(preset.traps.map((t) => [t.instanceId, t]));

  const buildings = village.buildings.map((b) => {
    const pos = buildingPos.get(b.instanceId);
    return pos ? { ...b, gridX: pos.gridX, gridY: pos.gridY } : b;
  });

  const walls: PlacedWall[] = village.walls.map((w) => {
    const pos = wallPos.get(w.instanceId);
    return pos ? { ...w, gridX: pos.gridX, gridY: pos.gridY } : w;
  });

  const traps: PlacedTrap[] = (village.traps ?? []).map((t) => {
    const pos = trapPos.get(t.instanceId);
    return pos ? { ...t, gridX: pos.gridX, gridY: pos.gridY } : t;
  });

  return { ...village, buildings, walls, traps };
}
