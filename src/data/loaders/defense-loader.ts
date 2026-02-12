import type { DefenseBuildingData, DefenseLevelStats, DefensesData } from '../../types';
import defensesJson from '../defenses.json';

export const defenses = defensesJson as unknown as DefensesData;

export function getDefense(name: string): DefenseBuildingData | undefined {
  return defenses[name];
}

export function getDefenseAtLevel(
  name: string,
  level: number,
): DefenseLevelStats | undefined {
  const defense = defenses[name];
  if (!defense) return undefined;
  return defense.levels.find((l) => l.level === level);
}

export function getDefenseMaxCount(
  name: string,
  thLevel: number,
): number | undefined {
  const defense = defenses[name];
  if (!defense) return undefined;
  return defense.maxCountByTH[String(thLevel)];
}

export function getAllDefenseNames(): string[] {
  return Object.keys(defenses);
}
