import { getWallConnection, wallKey } from '../wall-connections.ts';

/** Build an occupancy set from a list of [x, y] wall tiles. */
function setOf(tiles: Array<[number, number]>): Set<string> {
  return new Set(tiles.map(([x, y]) => wallKey(x, y)));
}

describe('wallKey', () => {
  it('formats coordinates as "x,y"', () => {
    expect(wallKey(3, 7)).toBe('3,7');
    expect(wallKey(-1, 0)).toBe('-1,0');
  });
});

describe('getWallConnection', () => {
  it('reports an isolated wall with no neighbours', () => {
    const c = getWallConnection(5, 5, setOf([[5, 5]]));
    expect(c.count).toBe(0);
    expect(c.type).toBe('isolated');
    expect(c.neighbours).toEqual({ north: false, south: false, west: false, east: false });
  });

  it('reports an end when exactly one neighbour is present', () => {
    const c = getWallConnection(5, 5, setOf([[5, 5], [6, 5]]));
    expect(c.count).toBe(1);
    expect(c.type).toBe('end');
    expect(c.neighbours.east).toBe(true);
  });

  it('reports a horizontal straight run (west + east)', () => {
    const c = getWallConnection(5, 5, setOf([[4, 5], [5, 5], [6, 5]]));
    expect(c.count).toBe(2);
    expect(c.type).toBe('straight');
    expect(c.neighbours.west).toBe(true);
    expect(c.neighbours.east).toBe(true);
  });

  it('reports a vertical straight run (north + south)', () => {
    const c = getWallConnection(5, 5, setOf([[5, 4], [5, 5], [5, 6]]));
    expect(c.count).toBe(2);
    expect(c.type).toBe('straight');
  });

  it('reports a corner for two perpendicular neighbours', () => {
    // north + east -> corner
    const c = getWallConnection(5, 5, setOf([[5, 5], [5, 4], [6, 5]]));
    expect(c.count).toBe(2);
    expect(c.type).toBe('corner');
    expect(c.neighbours.north).toBe(true);
    expect(c.neighbours.east).toBe(true);
  });

  it('reports a T-junction for three neighbours', () => {
    const c = getWallConnection(5, 5, setOf([[5, 5], [4, 5], [6, 5], [5, 6]]));
    expect(c.count).toBe(3);
    expect(c.type).toBe('t');
  });

  it('reports a cross for four neighbours', () => {
    const c = getWallConnection(5, 5, setOf([[5, 5], [4, 5], [6, 5], [5, 4], [5, 6]]));
    expect(c.count).toBe(4);
    expect(c.type).toBe('cross');
  });

  it('ignores diagonal neighbours (they do not connect)', () => {
    const c = getWallConnection(5, 5, setOf([[5, 5], [4, 4], [6, 6]]));
    expect(c.count).toBe(0);
    expect(c.type).toBe('isolated');
  });
});
