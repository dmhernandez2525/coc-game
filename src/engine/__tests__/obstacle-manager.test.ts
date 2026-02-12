import {
  getObstacleGemReward,
  createObstacle,
  trySpawnObstacle,
  removeObstacle,
} from '../obstacle-manager.ts';
import type { Obstacle } from '../obstacle-manager.ts';

// ---------------------------------------------------------------------------
// getObstacleGemReward
// ---------------------------------------------------------------------------

describe('getObstacleGemReward', () => {
  const EXPECTED_PATTERN = [6, 0, 4, 5, 1, 3, 2, 0, 0, 5, 1, 0, 3, 4, 0, 0, 5, 0, 1, 0];

  it('returns 6 for the first spawned obstacle (index 0)', () => {
    expect(getObstacleGemReward(0)).toBe(6);
  });

  it('returns 0 for index 1', () => {
    expect(getObstacleGemReward(1)).toBe(0);
  });

  it('returns correct values across the full 20-element cycle', () => {
    for (let i = 0; i < EXPECTED_PATTERN.length; i++) {
      expect(getObstacleGemReward(i)).toBe(EXPECTED_PATTERN[i]);
    }
  });

  it('wraps around after index 19 (cycle length 20)', () => {
    expect(getObstacleGemReward(20)).toBe(6); // same as index 0
    expect(getObstacleGemReward(21)).toBe(0); // same as index 1
    expect(getObstacleGemReward(42)).toBe(4); // same as index 2
  });
});

// ---------------------------------------------------------------------------
// createObstacle
// ---------------------------------------------------------------------------

describe('createObstacle', () => {
  it('creates a tree when counter is 0', () => {
    const obs = createObstacle(5, 10, 0);
    expect(obs.type).toBe('tree');
    expect(obs.instanceId).toBe('obs_0');
    expect(obs.gridX).toBe(5);
    expect(obs.gridY).toBe(10);
  });

  it('creates a bush when counter is 1', () => {
    expect(createObstacle(0, 0, 1).type).toBe('bush');
  });

  it('creates a stone when counter is 2', () => {
    expect(createObstacle(0, 0, 2).type).toBe('stone');
  });

  it('creates a mushroom when counter is 3', () => {
    expect(createObstacle(0, 0, 3).type).toBe('mushroom');
  });

  it('wraps back to tree when counter is 4', () => {
    expect(createObstacle(0, 0, 4).type).toBe('tree');
  });

  it('assigns correct removal cost for each type', () => {
    expect(createObstacle(0, 0, 0).removalCost).toBe(500);  // tree
    expect(createObstacle(0, 0, 1).removalCost).toBe(300);  // bush
    expect(createObstacle(0, 0, 2).removalCost).toBe(1000); // stone
    expect(createObstacle(0, 0, 3).removalCost).toBe(200);  // mushroom
  });

  it('assigns correct removal time for each type', () => {
    expect(createObstacle(0, 0, 0).removalTime).toBe(20);  // tree
    expect(createObstacle(0, 0, 1).removalTime).toBe(10);  // bush
    expect(createObstacle(0, 0, 2).removalTime).toBe(30);  // stone
    expect(createObstacle(0, 0, 3).removalTime).toBe(10);  // mushroom
  });

  it('stores the grid position in the returned obstacle', () => {
    const obs = createObstacle(20, 30, 7);
    expect(obs.gridX).toBe(20);
    expect(obs.gridY).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// trySpawnObstacle
// ---------------------------------------------------------------------------

describe('trySpawnObstacle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the obstacle cap (40) is reached', () => {
    const fullList: Obstacle[] = Array.from({ length: 40 }, (_, i) =>
      createObstacle(i % 44, Math.floor(i / 44), i),
    );
    const result = trySpawnObstacle(fullList, [], [], 40);
    expect(result).toBeNull();
  });

  it('spawns an obstacle on an empty grid with no buildings', () => {
    // Mock Math.random to return values that place at (10, 10)
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(10 / 44) // x = floor(10/44 * 44) = 10
      .mockReturnValueOnce(10 / 44); // y = 10

    const result = trySpawnObstacle([], [], [], 0);
    expect(result).not.toBeNull();
    expect(result!.gridX).toBe(10);
    expect(result!.gridY).toBe(10);
    expect(result!.type).toBe('tree');
  });

  it('returns null when the random position overlaps a building', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(5 / 44) // x = 5
      .mockReturnValueOnce(5 / 44); // y = 5

    const buildings = [{ gridX: 4, gridY: 4 }];
    const sizes = [{ w: 3, h: 3 }]; // occupies 4..6 x 4..6

    const result = trySpawnObstacle([], buildings, sizes, 0);
    expect(result).toBeNull();
  });

  it('returns null when the random position overlaps an existing obstacle', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(7 / 44)
      .mockReturnValueOnce(7 / 44);

    const existing: Obstacle[] = [createObstacle(7, 7, 0)];
    const result = trySpawnObstacle(existing, [], [], 1);
    expect(result).toBeNull();
  });

  it('uses the provided obstacleCounter to determine obstacle type', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // x = 0
      .mockReturnValueOnce(0); // y = 0

    const result = trySpawnObstacle([], [], [], 5);
    expect(result).not.toBeNull();
    // counter 5 % 4 = 1, so type should be bush
    expect(result!.type).toBe('bush');
  });

  it('allows spawning when obstacle count is below the cap', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(20 / 44)
      .mockReturnValueOnce(20 / 44);

    const partialList: Obstacle[] = Array.from({ length: 39 }, (_, i) =>
      createObstacle(i, 0, i),
    );
    const result = trySpawnObstacle(partialList, [], [], 39);
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// removeObstacle
// ---------------------------------------------------------------------------

describe('removeObstacle', () => {
  it('filters out the obstacle with the matching instanceId', () => {
    const obstacles: Obstacle[] = [
      createObstacle(0, 0, 0),
      createObstacle(1, 1, 1),
      createObstacle(2, 2, 2),
    ];
    const result = removeObstacle(obstacles, 'obs_1');
    expect(result).toHaveLength(2);
    expect(result.find((o) => o.instanceId === 'obs_1')).toBeUndefined();
  });

  it('returns the full array when the instanceId does not exist', () => {
    const obstacles: Obstacle[] = [createObstacle(0, 0, 0)];
    const result = removeObstacle(obstacles, 'obs_999');
    expect(result).toHaveLength(1);
  });

  it('returns an empty array when removing the only obstacle', () => {
    const obstacles: Obstacle[] = [createObstacle(0, 0, 0)];
    const result = removeObstacle(obstacles, 'obs_0');
    expect(result).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const obstacles: Obstacle[] = [
      createObstacle(0, 0, 0),
      createObstacle(1, 1, 1),
    ];
    const result = removeObstacle(obstacles, 'obs_0');
    expect(obstacles).toHaveLength(2);
    expect(result).toHaveLength(1);
  });
});
