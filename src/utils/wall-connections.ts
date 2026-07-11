// Classifies how a wall segment connects to its four orthogonal neighbours so
// the renderer can draw the right junction art (straight run, corner, T, cross).
// Pure: depends only on the passed occupancy set, never on canvas or state.

/** The four wall neighbours, keyed by compass direction. */
export interface WallNeighbours {
  north: boolean; // gridY - 1
  south: boolean; // gridY + 1
  west: boolean; // gridX - 1
  east: boolean; // gridX + 1
}

/**
 * Junction shape for a wall segment:
 * - isolated: no neighbours
 * - end: exactly one neighbour (a run terminates here)
 * - straight: two opposite neighbours (a straight run passes through)
 * - corner: two perpendicular neighbours (the run turns here)
 * - t: three neighbours
 * - cross: all four neighbours
 */
export type WallConnectionType = 'isolated' | 'end' | 'straight' | 'corner' | 't' | 'cross';

export interface WallConnection {
  neighbours: WallNeighbours;
  count: number;
  type: WallConnectionType;
}

/** Build the `"x,y"` key used by the occupancy set. */
export function wallKey(gridX: number, gridY: number): string {
  return `${gridX},${gridY}`;
}

function classify(n: WallNeighbours, count: number): WallConnectionType {
  if (count === 0) return 'isolated';
  if (count === 1) return 'end';
  if (count === 4) return 'cross';
  if (count === 3) return 't';
  // count === 2: straight when the pair is opposite, otherwise a corner
  const straight = (n.north && n.south) || (n.west && n.east);
  return straight ? 'straight' : 'corner';
}

/**
 * Inspect the four orthogonal neighbours of a wall tile and report how it
 * connects. `wallSet` holds `"x,y"` keys for every occupied wall tile.
 */
export function getWallConnection(
  gridX: number,
  gridY: number,
  wallSet: Set<string>,
): WallConnection {
  const neighbours: WallNeighbours = {
    north: wallSet.has(wallKey(gridX, gridY - 1)),
    south: wallSet.has(wallKey(gridX, gridY + 1)),
    west: wallSet.has(wallKey(gridX - 1, gridY)),
    east: wallSet.has(wallKey(gridX + 1, gridY)),
  };

  const count =
    (neighbours.north ? 1 : 0) +
    (neighbours.south ? 1 : 0) +
    (neighbours.west ? 1 : 0) +
    (neighbours.east ? 1 : 0);

  return { neighbours, count, type: classify(neighbours, count) };
}
