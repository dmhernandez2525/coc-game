import type { DeployedTroop, ActiveDefense, BattleBuilding } from '../types/battle.ts';

/** Euclidean distance between two points. */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/**
 * Move a position toward a target at the given speed.
 * Tiles per second = speed / 8. Snaps to target if within one step.
 */
export function moveToward(
  x: number, y: number, targetX: number, targetY: number,
  speed: number, deltaMs: number,
): { x: number; y: number } {
  const dist = distance(x, y, targetX, targetY);
  if (dist === 0) return { x, y };
  const step = (speed / 8) * (deltaMs / 1000);
  if (dist <= step) return { x: targetX, y: targetY };
  const ratio = step / dist;
  return { x: x + (targetX - x) * ratio, y: y + (targetY - y) * ratio };
}

const RESOURCE_KEYWORDS = ['Storage', 'Mine', 'Collector', 'Drill', 'Town Hall'];
const GROUND_ONLY_DEFENSES = new Set(['Cannon', 'Mortar']);

type Targetable = { id: string; x: number; y: number; isDestroyed: boolean; name: string };

function findNearest(x: number, y: number, candidates: Targetable[]): Targetable | null {
  let best: Targetable | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.isDestroyed) continue;
    const d = distance(x, y, c.x, c.y);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

function toTargetable(buildings: BattleBuilding[], defenses: ActiveDefense[]): Targetable[] {
  const result: Targetable[] = buildings.map((b) => (
    { id: b.instanceId, x: b.x, y: b.y, isDestroyed: b.isDestroyed, name: b.name }
  ));
  for (const d of defenses) {
    result.push({ id: d.buildingInstanceId, x: d.x, y: d.y, isDestroyed: d.isDestroyed, name: d.name });
  }
  return result;
}

/** Find the preferred target or fall back to nearest any building. */
function preferredOrFallback(
  x: number, y: number, preferred: Targetable[], all: Targetable[],
): string | null {
  return (findNearest(x, y, preferred) ?? findNearest(x, y, all))?.id ?? null;
}

// Lookup table mapping favoriteTarget values to filter functions.
const TARGET_FILTERS: Record<string, (t: Targetable, defenses: ActiveDefense[]) => boolean> = {
  Defenses: (t, defenses) => defenses.some((d) => d.buildingInstanceId === t.id),
  Resources: (t) => RESOURCE_KEYWORDS.some((kw) => t.name.includes(kw)),
  Walls: (t) => t.name === 'Wall',
};

/**
 * Check if a wall segment lies close enough to the line between two points
 * to be considered "blocking" the path. Uses point-to-line-segment distance.
 * Walls occupy 1x1 tiles, so we check if the wall center is within 0.6 tiles
 * of the movement line (slightly larger than 0.5 to account for wall footprint).
 */
export function isWallBlocking(
  fromX: number, fromY: number, toX: number, toY: number, wall: BattleBuilding,
): boolean {
  if (wall.isDestroyed || wall.name !== 'Wall') return false;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return false;

  // Project wall center onto the line segment, clamping t to [0, 1]
  const t = Math.max(0, Math.min(1, ((wall.x - fromX) * dx + (wall.y - fromY) * dy) / lenSq));
  const projX = fromX + t * dx;
  const projY = fromY + t * dy;
  const dist = distance(projX, projY, wall.x, wall.y);

  return dist < 0.6;
}

/**
 * Find the nearest wall that blocks the path from a troop to its intended target.
 * Returns the wall's instanceId, or null if no wall blocks the path.
 */
export function findBlockingWall(
  troop: DeployedTroop, targetX: number, targetY: number, buildings: BattleBuilding[],
): string | null {
  let nearest: BattleBuilding | null = null;
  let nearestDist = Infinity;

  for (const b of buildings) {
    if (!isWallBlocking(troop.x, troop.y, targetX, targetY, b)) continue;
    const d = distance(troop.x, troop.y, b.x, b.y);
    if (d < nearestDist) { nearestDist = d; nearest = b; }
  }

  return nearest?.instanceId ?? null;
}

/**
 * Find the best target for a troop based on its favoriteTarget preference.
 * Returns the target id (instanceId or buildingInstanceId), or null if nothing remains.
 */
export function findTroopTarget(
  troop: DeployedTroop,
  buildings: BattleBuilding[],
  defenses: ActiveDefense[],
  favoriteTarget: string | null,
): string | null {
  const all = toTargetable(buildings, defenses);

  if (favoriteTarget && favoriteTarget !== 'None' && favoriteTarget !== 'Any Building') {
    const filter = TARGET_FILTERS[favoriteTarget];
    if (filter) {
      const preferred = all.filter((t) => filter(t, defenses));
      return preferredOrFallback(troop.x, troop.y, preferred, all);
    }
  }

  return findNearest(troop.x, troop.y, all)?.id ?? null;
}

/**
 * Find the nearest alive troop within a defense's range.
 * Cannons and Mortars cannot target flying troops.
 */
export function findDefenseTarget(
  defense: ActiveDefense, troops: DeployedTroop[],
): string | null {
  const canTargetAir = !GROUND_ONLY_DEFENSES.has(defense.name);
  let best: DeployedTroop | null = null;
  let bestDist = Infinity;

  for (const troop of troops) {
    if (troop.state === 'dead') continue;
    if (troop.isFlying && !canTargetAir) continue;
    const d = distance(defense.x, defense.y, troop.x, troop.y);
    if (d < defense.range.min || d > defense.range.max) continue;
    if (d < bestDist) { bestDist = d; best = troop; }
  }

  return best?.id ?? null;
}
