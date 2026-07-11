// Procedural NPC base generation: deterministic layouts built from seeded RNG.
// Produces extra multiplayer bases per Town Hall (rings, compartments, diamonds)
// and one distinct base per single-player campaign level.
// All functions are pure and deterministic for a given input.

import type { PlacedBuilding } from '../types/village.ts';
import type { NPCBase } from './npc-bases.ts';
import { createSeededRng, hashStringToSeed, randomInt, type Rng } from '../utils/seeded-rng.ts';

// -- Types --

export type BaseArchetype = 'ring' | 'compartments' | 'diamond';

interface RosterEntry {
  buildingId: string;
  count: number;
  levelOffset: number; // defense level = clamp(th - levelOffset, 1, th)
}

interface GridPos {
  x: number;
  y: number;
}

// -- Constants --

// Keep every building on the 40x30 battle canvas with a small margin.
const CENTER: GridPos = { x: 20, y: 15 };
const MIN_X = 4;
const MAX_X = 36;
const MIN_Y = 3;
const MAX_Y = 27;

export const CAMPAIGN_LEVEL_COUNT = 90;

// Defenses available at each TH level, mirroring the handcrafted library.
const DEFENSE_ROSTERS: Record<number, RosterEntry[]> = {
  1: [{ buildingId: 'Cannon', count: 1, levelOffset: 0 }],
  2: [
    { buildingId: 'Cannon', count: 1, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 1, levelOffset: 1 },
  ],
  3: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 1, levelOffset: 0 },
    { buildingId: 'Mortar', count: 1, levelOffset: 2 },
  ],
  4: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 2, levelOffset: 1 },
    { buildingId: 'Mortar', count: 1, levelOffset: 2 },
    { buildingId: 'Air Defense', count: 1, levelOffset: 3 },
  ],
  5: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 2, levelOffset: 0 },
    { buildingId: 'Mortar', count: 1, levelOffset: 2 },
    { buildingId: 'Air Defense', count: 1, levelOffset: 2 },
    { buildingId: 'Wizard Tower', count: 1, levelOffset: 4 },
  ],
  6: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 2, levelOffset: 0 },
    { buildingId: 'Mortar', count: 1, levelOffset: 2 },
    { buildingId: 'Air Defense', count: 1, levelOffset: 2 },
    { buildingId: 'Wizard Tower', count: 1, levelOffset: 3 },
    { buildingId: 'Air Sweeper', count: 1, levelOffset: 5 },
  ],
  7: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 2, levelOffset: 0 },
    { buildingId: 'Mortar', count: 2, levelOffset: 2 },
    { buildingId: 'Air Defense', count: 1, levelOffset: 2 },
    { buildingId: 'Wizard Tower', count: 1, levelOffset: 3 },
    { buildingId: 'Hidden Tesla', count: 1, levelOffset: 6 },
  ],
  8: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 2, levelOffset: 0 },
    { buildingId: 'Mortar', count: 2, levelOffset: 1 },
    { buildingId: 'Air Defense', count: 2, levelOffset: 2 },
    { buildingId: 'Wizard Tower', count: 2, levelOffset: 3 },
    { buildingId: 'Bomb Tower', count: 1, levelOffset: 7 },
  ],
  9: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 2, levelOffset: 0 },
    { buildingId: 'Air Defense', count: 2, levelOffset: 2 },
    { buildingId: 'Wizard Tower', count: 2, levelOffset: 3 },
    { buildingId: 'Hidden Tesla', count: 2, levelOffset: 4 },
    { buildingId: 'X-Bow', count: 1, levelOffset: 8 },
  ],
  10: [
    { buildingId: 'Cannon', count: 2, levelOffset: 0 },
    { buildingId: 'Archer Tower', count: 2, levelOffset: 0 },
    { buildingId: 'Air Defense', count: 2, levelOffset: 2 },
    { buildingId: 'Wizard Tower', count: 2, levelOffset: 2 },
    { buildingId: 'X-Bow', count: 2, levelOffset: 7 },
    { buildingId: 'Inferno Tower', count: 1, levelOffset: 9 },
  ],
};

const ARCHETYPES: readonly BaseArchetype[] = ['ring', 'compartments', 'diamond'];

const ARCHETYPE_NAMES: Record<BaseArchetype, string> = {
  ring: 'Ring Fort',
  compartments: 'Walled Compound',
  diamond: 'Diamond Redoubt',
};

const CAMPAIGN_NAME_POOL = [
  'Outpost', 'Camp', 'Den', 'Hollow', 'Crossing', 'Quarry', 'Fort',
  'Garrison', 'Bastion', 'Stronghold', 'Keep', 'Citadel',
] as const;

// -- Position helpers --

function clampToBounds(pos: GridPos): GridPos {
  return {
    x: Math.min(MAX_X, Math.max(MIN_X, Math.round(pos.x))),
    y: Math.min(MAX_Y, Math.max(MIN_Y, Math.round(pos.y))),
  };
}

function posKey(pos: GridPos): string {
  return `${pos.x},${pos.y}`;
}

/** Claim a free cell at or near the requested position (small spiral search). */
function claimCell(occupied: Set<string>, desired: GridPos): GridPos {
  const start = clampToBounds(desired);
  for (let radius = 0; radius <= 6; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate = clampToBounds({ x: start.x + dx, y: start.y + dy });
        const key = posKey(candidate);
        if (!occupied.has(key)) {
          occupied.add(key);
          return candidate;
        }
      }
    }
  }
  // Grid has far more cells than any roster; unreachable in practice.
  occupied.add(posKey(start));
  return start;
}

/** Evenly spaced points on a circle around the base center. */
function circlePoints(count: number, radius: number, angleOffset: number): GridPos[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = angleOffset + (i / count) * Math.PI * 2;
    return {
      x: CENTER.x + Math.cos(angle) * radius,
      y: CENTER.y + Math.sin(angle) * radius * 0.75,
    };
  });
}

/** Perimeter of a square wall box around the center, with gate gaps. */
function squarePerimeter(radius: number, gapEvery: number): GridPos[] {
  const points: GridPos[] = [];
  let index = 0;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      index += 1;
      if (gapEvery > 0 && index % gapEvery === 0) continue;
      points.push({ x: CENTER.x + dx, y: CENTER.y + dy });
    }
  }
  return points;
}

/** Perimeter of a diamond (Manhattan ring) around the center. */
function diamondPerimeter(radius: number): GridPos[] {
  const points: GridPos[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    const dy = radius - Math.abs(dx);
    points.push({ x: CENTER.x + dx, y: CENTER.y + dy });
    if (dy !== 0) points.push({ x: CENTER.x + dx, y: CENTER.y - dy });
  }
  return points;
}

// -- Layout anchors per archetype --

interface LayoutAnchors {
  defenseRing: GridPos[];
  resourceRing: GridPos[];
  wallCells: GridPos[];
}

function buildAnchors(archetype: BaseArchetype, defenseCount: number, rng: Rng): LayoutAnchors {
  const spin = rng() * Math.PI * 2;
  const anchorBuilders: Record<BaseArchetype, () => LayoutAnchors> = {
    ring: () => ({
      defenseRing: circlePoints(defenseCount, 6, spin),
      resourceRing: circlePoints(6, 11, spin + 0.4),
      wallCells: squarePerimeter(3, 0),
    }),
    compartments: () => ({
      defenseRing: circlePoints(defenseCount, 5, spin),
      resourceRing: circlePoints(6, 12, spin + 0.7),
      wallCells: [...squarePerimeter(2, 0), ...squarePerimeter(7, 9)],
    }),
    diamond: () => ({
      defenseRing: circlePoints(defenseCount, 7, spin + Math.PI / 4),
      resourceRing: circlePoints(6, 11, spin),
      wallCells: diamondPerimeter(4),
    }),
  };
  return anchorBuilders[archetype]();
}

// -- Building factories --

function makeBuilding(
  idPrefix: string,
  counter: number,
  buildingId: string,
  buildingType: PlacedBuilding['buildingType'],
  level: number,
  pos: GridPos,
  uncollectedResources?: number,
): PlacedBuilding {
  return {
    instanceId: `${idPrefix}_b${counter}`,
    buildingId,
    buildingType,
    level,
    gridX: pos.x,
    gridY: pos.y,
    isUpgrading: false,
    upgradeTimeRemaining: 0,
    assignedBuilder: null,
    ...(uncollectedResources !== undefined ? { uncollectedResources } : {}),
  };
}

function defenseLevel(th: number, entry: RosterEntry, rng: Rng): number {
  const jitter = randomInt(rng, 0, 1);
  return Math.max(1, Math.min(th + 2, th - entry.levelOffset + jitter));
}

interface ResourceSpec {
  buildingId: string;
  buildingType: PlacedBuilding['buildingType'];
  level: number;
  uncollected?: number;
}

function resourceSpecs(th: number): ResourceSpec[] {
  const collectorLoot = th * th * 120;
  const specs: ResourceSpec[] = [
    { buildingId: 'Gold Mine', buildingType: 'resource_collector', level: th, uncollected: collectorLoot },
    { buildingId: 'Elixir Collector', buildingType: 'resource_collector', level: th, uncollected: Math.floor(collectorLoot * 0.9) },
    { buildingId: 'Gold Storage', buildingType: 'resource_storage', level: th },
    { buildingId: 'Elixir Storage', buildingType: 'resource_storage', level: th },
  ];
  if (th >= 7) {
    specs.push(
      { buildingId: 'Dark Elixir Drill', buildingType: 'resource_collector', level: Math.max(1, th - 6), uncollected: th * 40 },
      { buildingId: 'Dark Elixir Storage', buildingType: 'resource_storage', level: Math.max(1, th - 6) },
    );
  }
  return specs;
}

// -- Core generation --

interface GenerateOptions {
  id: string;
  name: string;
  townHallLevel: number;
  archetype: BaseArchetype;
  seed: number;
  /** Scales defense levels and loot (campaign difficulty). Defaults to 0. */
  difficultyBonus?: number;
}

function baseLoot(th: number, difficultyBonus: number, rng: Rng): NPCBase['loot'] {
  const scale = 1 + difficultyBonus * 0.15 + rng() * 0.2;
  const gold = Math.round(th * th * 700 * scale / 100) * 100;
  return {
    gold,
    elixir: Math.round(gold * 0.9 / 100) * 100,
    darkElixir: th >= 7 ? Math.round(th * 60 * scale / 10) * 10 : 0,
  };
}

/** Generate one deterministic NPC base for the given options. */
export function generateNPCBase(options: GenerateOptions): NPCBase {
  const { id, name, townHallLevel, archetype, seed } = options;
  const difficultyBonus = options.difficultyBonus ?? 0;
  const th = Math.min(10, Math.max(1, townHallLevel));
  const rng = createSeededRng(seed);
  const occupied = new Set<string>();
  const buildings: PlacedBuilding[] = [];
  let counter = 0;

  const next = (
    buildingId: string,
    buildingType: PlacedBuilding['buildingType'],
    level: number,
    desired: GridPos,
    uncollected?: number,
  ) => {
    counter += 1;
    const pos = claimCell(occupied, desired);
    buildings.push(makeBuilding(id, counter, buildingId, buildingType, level, pos, uncollected));
  };

  // Town Hall always sits at the center of the layout.
  next('Town Hall', 'other', th, CENTER);

  const roster = DEFENSE_ROSTERS[th] ?? DEFENSE_ROSTERS[1]!;
  const defenseEntries = roster.flatMap((entry) =>
    Array.from({ length: entry.count }, () => entry),
  );
  const anchors = buildAnchors(archetype, defenseEntries.length, rng);

  defenseEntries.forEach((entry, i) => {
    const level = Math.min(th + 2, defenseLevel(th, entry, rng) + difficultyBonus);
    next(entry.buildingId, 'defense', level, anchors.defenseRing[i] ?? CENTER);
  });

  resourceSpecs(th).forEach((spec, i) => {
    const desired = anchors.resourceRing[i % anchors.resourceRing.length] ?? CENTER;
    next(spec.buildingId, spec.buildingType, spec.level, desired, spec.uncollected);
  });

  // Walls only appear from TH2 up (TH1 camps are open, like the real game).
  if (th >= 2) {
    for (const cell of anchors.wallCells) {
      next('Wall', 'other', Math.max(1, th - 1), cell);
    }
  }

  return {
    id,
    name,
    townHallLevel: th,
    buildings,
    trophyOffer: 8 + th * 3 + randomInt(rng, 0, 4),
    loot: baseLoot(th, difficultyBonus, rng),
  };
}

// -- Multiplayer library expansion --

/** Extra procedurally generated multiplayer bases: 3 per TH 1-10. */
export function generateMultiplayerBases(): NPCBase[] {
  const bases: NPCBase[] = [];
  for (let th = 1; th <= 10; th++) {
    ARCHETYPES.forEach((archetype, variant) => {
      const id = `npc_th${th}_g${variant + 1}`;
      bases.push(generateNPCBase({
        id,
        name: `Goblin ${ARCHETYPE_NAMES[archetype]} ${th}`,
        townHallLevel: th,
        archetype,
        seed: hashStringToSeed(id),
      }));
    });
  }
  return bases;
}

// -- Campaign bases --

function campaignTownHall(levelNumber: number): number {
  return Math.min(10, Math.max(1, Math.ceil(levelNumber / 10)));
}

function campaignDifficultyBonus(levelNumber: number): number {
  const positionInGroup = (levelNumber - 1) % 10;
  if (positionInGroup < 3) return 0;
  return positionInGroup < 7 ? 1 : 2;
}

function campaignName(levelNumber: number): string {
  const noun = CAMPAIGN_NAME_POOL[(levelNumber - 1) % CAMPAIGN_NAME_POOL.length]!;
  return `Goblin ${noun} ${levelNumber}`;
}

/**
 * Deterministic base layout for a single-player campaign level (1-90).
 * Each level gets its own layout; difficulty within a TH band raises
 * defense levels and loot.
 */
export function getCampaignBase(levelNumber: number): NPCBase | null {
  if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > CAMPAIGN_LEVEL_COUNT) {
    return null;
  }
  const id = `campaign_base_${levelNumber}`;
  return generateNPCBase({
    id,
    name: campaignName(levelNumber),
    townHallLevel: campaignTownHall(levelNumber),
    archetype: ARCHETYPES[(levelNumber - 1) % ARCHETYPES.length]!,
    seed: hashStringToSeed(id),
    difficultyBonus: campaignDifficultyBonus(levelNumber),
  });
}

/** All 90 campaign bases, in level order. */
export function getAllCampaignBases(): NPCBase[] {
  return Array.from(
    { length: CAMPAIGN_LEVEL_COUNT },
    (_, i) => getCampaignBase(i + 1)!,
  );
}
