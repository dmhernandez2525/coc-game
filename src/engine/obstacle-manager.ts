import { gemsAndItemsData } from '../data/loaders/economy-loader.ts';
import { GRID_SIZE, isInBounds } from '../utils/grid-utils.ts';

export interface Obstacle {
  instanceId: string;
  type: string; // 'tree', 'bush', 'stone', 'mushroom', 'gem_box'
  gridX: number;
  gridY: number;
  removalCost: number; // in gold
  removalTime: number; // in seconds
}

const OBSTACLE_TYPES = ['tree', 'bush', 'stone', 'mushroom'] as const;

const MAX_OBSTACLES = 40;

const REMOVAL_COSTS: Record<string, number> = {
  tree: 500,
  bush: 300,
  stone: 1000,
  mushroom: 200,
};

const REMOVAL_TIMES: Record<string, number> = {
  tree: 20,
  bush: 10,
  stone: 30,
  mushroom: 10,
};

/**
 * Returns the gem reward for removing the Nth spawned obstacle,
 * cycling through the pattern defined in gems_and_items.json.
 */
export function getObstacleGemReward(obstacleIndex: number): number {
  const pattern = gemsAndItemsData.obstacleGemRewards
    .spawnedObstacleCycle.pattern as number[];
  return pattern[obstacleIndex % pattern.length] ?? 0;
}

/** Create a new obstacle at the given grid position. */
export function createObstacle(
  gridX: number,
  gridY: number,
  obstacleCounter: number,
): Obstacle {
  const type = OBSTACLE_TYPES[obstacleCounter % OBSTACLE_TYPES.length] ?? 'tree';
  return {
    instanceId: `obs_${obstacleCounter}`,
    type,
    gridX,
    gridY,
    removalCost: REMOVAL_COSTS[type] ?? 500,
    removalTime: REMOVAL_TIMES[type] ?? 20,
  };
}

/**
 * Attempt to spawn a new obstacle on the grid. Returns the new obstacle
 * if a valid empty tile was found, or null if the random position was
 * occupied or the obstacle cap has been reached.
 */
export function trySpawnObstacle(
  obstacles: Obstacle[],
  buildings: ReadonlyArray<{ gridX: number; gridY: number }>,
  buildingSizes: ReadonlyArray<{ w: number; h: number }>,
  obstacleCounter: number,
): Obstacle | null {
  if (obstacles.length >= MAX_OBSTACLES) return null;

  const x = Math.floor(Math.random() * GRID_SIZE);
  const y = Math.floor(Math.random() * GRID_SIZE);

  if (!isInBounds(x, y)) return null;

  // Check overlap with buildings
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const s = buildingSizes[i];
    if (!b || !s) continue;
    if (x >= b.gridX && x < b.gridX + s.w && y >= b.gridY && y < b.gridY + s.h) {
      return null;
    }
  }

  // Check overlap with existing obstacles
  for (const obs of obstacles) {
    if (obs.gridX === x && obs.gridY === y) return null;
  }

  return createObstacle(x, y, obstacleCounter);
}

/** Remove an obstacle by instanceId, returning the filtered array. */
export function removeObstacle(
  obstacles: Obstacle[],
  instanceId: string,
): Obstacle[] {
  return obstacles.filter((o) => o.instanceId !== instanceId);
}
