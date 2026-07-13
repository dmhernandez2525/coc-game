import type { ResearchJob, ResourceAmounts, VillageState } from '../types/village.ts';
import { getTroop } from '../data/loaders/troop-loader.ts';
import { getLabLevel } from './army-manager.ts';

const RESOURCE_KEYS: Record<string, ResearchJob['resource']> = {
  Elixir: 'elixir',
  'Dark Elixir': 'darkElixir',
};

export interface ResearchOption {
  troopName: string;
  currentLevel: number;
  targetLevel: number;
  labLevelRequired: number;
  resource: ResearchJob['resource'];
  cost: number;
  timeSeconds: number;
}

export function getTroopResearchLevel(state: VillageState, troopName: string): number {
  const trainedLevel = state.army.find((troop) => troop.name === troopName)?.level;
  const baseLevel = getTroop(troopName)?.levels[0]?.level ?? 1;
  return state.troopLevels?.[troopName] ?? trainedLevel ?? baseLevel;
}

export function getResearchOption(state: VillageState, troopName: string): ResearchOption | null {
  const troop = getTroop(troopName);
  if (!troop) return null;
  const currentLevel = getTroopResearchLevel(state, troopName);
  const next = troop.levels.find((level) => level.level === currentLevel + 1);
  if (!next) return null;
  const resource = RESOURCE_KEYS[next.upgradeResource];
  if (!resource) return null;
  return {
    troopName,
    currentLevel,
    targetLevel: next.level,
    labLevelRequired: next.labLevelRequired ?? 0,
    resource,
    cost: next.upgradeCost,
    timeSeconds: next.upgradeTime,
  };
}

export function canStartResearch(state: VillageState, troopName: string): boolean {
  if (state.activeResearch) return false;
  const lab = state.buildings.find((building) => building.buildingId === 'Laboratory');
  if (!lab || lab.isUpgrading) return false;
  const option = getResearchOption(state, troopName);
  if (!option || getLabLevel(state) < option.labLevelRequired) return false;
  return state.resources[option.resource] >= option.cost;
}

export function startResearch(state: VillageState, troopName: string): VillageState | null {
  if (!canStartResearch(state, troopName)) return null;
  const option = getResearchOption(state, troopName)!;
  const resources: ResourceAmounts = {
    ...state.resources,
    [option.resource]: state.resources[option.resource] - option.cost,
  };
  return {
    ...state,
    resources,
    troopLevels: { ...state.troopLevels, [troopName]: option.currentLevel },
    activeResearch: {
      troopName,
      fromLevel: option.currentLevel,
      targetLevel: option.targetLevel,
      resource: option.resource,
      cost: option.cost,
      totalTimeSeconds: option.timeSeconds,
      remainingTimeSeconds: option.timeSeconds,
    },
  };
}

export function tickResearch(state: VillageState, elapsedSeconds: number): VillageState {
  const job = state.activeResearch;
  if (!job || elapsedSeconds <= 0) return state;
  const remainingTimeSeconds = Math.max(0, job.remainingTimeSeconds - elapsedSeconds);
  if (remainingTimeSeconds > 0) {
    return { ...state, activeResearch: { ...job, remainingTimeSeconds } };
  }
  return {
    ...state,
    activeResearch: null,
    troopLevels: { ...state.troopLevels, [job.troopName]: job.targetLevel },
    army: state.army.map((troop) => (
      troop.name === job.troopName ? { ...troop, level: job.targetLevel } : troop
    )),
  };
}
