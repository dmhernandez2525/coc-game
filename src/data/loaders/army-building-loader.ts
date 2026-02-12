import type { ArmyBuildingData, ArmyBuildingsData } from '../../types';
import armyBuildingsJson from '../army_buildings.json';

export const armyBuildings = armyBuildingsJson as ArmyBuildingsData;

export function getArmyBuilding(name: string): ArmyBuildingData | undefined {
  return armyBuildings[name];
}

export function getAllArmyBuildingNames(): string[] {
  return Object.keys(armyBuildings);
}
