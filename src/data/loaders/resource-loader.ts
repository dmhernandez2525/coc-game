import type {
  ResourceBuildingData,
  ResourceCollectorData,
  ResourceStorageData,
} from '../../types';
import resourcesJson from '../resources.json';

export const resourceBuildings = resourcesJson as ResourceBuildingData[];

export function getCollectors(): ResourceCollectorData[] {
  return resourceBuildings.filter(
    (b): b is ResourceCollectorData => b.category === 'resource_collector',
  );
}

export function getStorages(): ResourceStorageData[] {
  return resourceBuildings.filter(
    (b): b is ResourceStorageData => b.category === 'resource_storage',
  );
}

export function getResourceBuilding(
  name: string,
): ResourceBuildingData | undefined {
  return resourceBuildings.find((b) => b.name === name);
}
