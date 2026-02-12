import type { TownHallData } from '../../types';
import townhallsJson from '../townhalls.json';

export const townhalls = townhallsJson as unknown as TownHallData[];

export function getTownHall(level: number): TownHallData | undefined {
  return townhalls.find((th) => th.level === level);
}

export function getMaxBuildingCount(
  thLevel: number,
  buildingName: string,
): number | undefined {
  const th = getTownHall(thLevel);
  if (!th) return undefined;
  return th.buildingCounts[buildingName];
}

export function getMaxStorageCapacity(
  thLevel: number,
): TownHallData['maxStorageCapacity'] | undefined {
  const th = getTownHall(thLevel);
  if (!th) return undefined;
  return th.maxStorageCapacity;
}
