import type { XBowMode } from './common';
import type { WarState } from '../engine/clan-war-manager.ts';
import type { WarLeagueState } from '../engine/war-league-manager.ts';
import type { GameStatistics } from '../engine/statistics-tracker.ts';
import type { AchievementProgress } from '../engine/achievement-manager.ts';

export interface ResourceAmounts {
  gold: number;
  elixir: number;
  darkElixir: number;
  gems: number;
}

export interface PlacedBuilding {
  instanceId: string;
  buildingId: string;
  buildingType: 'defense' | 'resource_collector' | 'resource_storage' | 'army' | 'other';
  level: number;
  gridX: number;
  gridY: number;
  isUpgrading: boolean;
  upgradeTimeRemaining: number;
  assignedBuilder: number | null;
  uncollectedResources?: number;
  lastCollectionTime?: number;
  xbowMode?: XBowMode;            // X-Bow only: player-selected targeting mode
  ammo?: number;
  maxAmmo?: number;
}

export interface PlacedWall {
  instanceId: string;
  level: number;
  gridX: number;
  gridY: number;
}

export interface PlacedTrap {
  instanceId: string;
  trapId: string;
  level: number;
  gridX: number;
  gridY: number;
  isArmed: boolean;
}

export interface BuilderSlot {
  id: number;
  isUnlocked: boolean;
  assignedTo: string | null;
  timeRemaining: number;
}

export interface TrainedTroop {
  name: string;
  level: number;
  count: number;
}

export interface ResearchJob {
  troopName: string;
  fromLevel: number;
  targetLevel: number;
  resource: 'elixir' | 'darkElixir';
  cost: number;
  totalTimeSeconds: number;
  remainingTimeSeconds: number;
}

/** Ore currencies earned from battles and spent on equipment upgrades. */
export interface OreAmounts {
  shinyOre: number;
  glowyOre: number;
  starryOre: number;
}

/** A named item tracked with its current upgrade level (equipment, pets). */
export interface OwnedLevelEntry {
  name: string;
  level: number;
}

export interface OwnedHero {
  name: string;
  level: number;
  currentHp: number;
  isRecovering: boolean;
  recoveryTimeRemaining: number;
  isUpgrading: boolean;
  upgradeTimeRemaining: number;
  equippedItems: [string | null, string | null];
  assignedPet: string | null;
}

export interface CampaignLevelProgress {
  levelNumber: number;
  stars: number;
  completed: boolean;
}

export interface CampaignProgress {
  levels: CampaignLevelProgress[];
  totalStars: number;
}

/** Loot pool held by the Treasury (war loot, league bonuses, star bonuses). */
export interface TreasuryAmounts {
  gold: number;
  elixir: number;
  darkElixir: number;
}

/** A super troop boost currently active in the village. */
export interface ActiveSuperTroopBoost {
  baseTroopName: string;
  superTroopName: string;
  remainingDurationMs: number;
}

/** A magic potion effect currently running on the game clock. */
export interface ActivePotionBoost {
  itemId: string;
  remainingMs: number;
}

/** Player clan (single-player donate simulation), persisted with the village. */
export interface VillageClanState {
  name: string;
  level: number;
  xp: number;
  badgeIndex: number;
  castleTroops: Array<{ name: string; level: number; count: number }>;
}

export interface VillageObstacle {
  instanceId: string;
  type: string;
  gridX: number;
  gridY: number;
  removalCost: number;
  removalTime: number;
}

export interface DefenseLogEntry {
  id: string;
  timestamp: number;
  attackerName: string;
  attackerTownHallLevel: number;
  stars: number;
  destructionPercent: number;
  durationSeconds: number;
  trophyChange: number;
  trapsTriggered: string[];
  lootStolen: Pick<ResourceAmounts, 'gold' | 'elixir' | 'darkElixir'>;
  result: 'victory' | 'defeat';
}

export interface VillageState {
  version: number;
  townHallLevel: number;
  buildings: PlacedBuilding[];
  walls: PlacedWall[];
  traps: PlacedTrap[];
  obstacles: VillageObstacle[];
  resources: ResourceAmounts;
  builders: BuilderSlot[];
  army: TrainedTroop[];
  spells: TrainedTroop[];
  heroes: OwnedHero[];
  /** Researched levels also exist for troops not currently trained. */
  troopLevels?: Record<string, number>;
  /** The Laboratory runs one persisted research job at a time. */
  activeResearch?: ResearchJob | null;
  // Optional: saves created before the ore/equipment/pet economy lack these
  ores?: OreAmounts;
  ownedEquipment?: OwnedLevelEntry[];
  ownedPets?: OwnedLevelEntry[];
  // Optional: saves created before the economy/progression systems lack these
  treasury?: TreasuryAmounts;
  // Optional: saves created before the clan castle / siege systems lack these
  clan?: VillageClanState;
  // Optional: saves created before the clan war / war league systems lack these
  war?: WarState;
  warLeague?: WarLeagueState;
  /** Set while the player is fighting a war attack in the battle screen. */
  pendingWarAttack?: { defenderIndex: number };
  siegeMachines?: TrainedTroop[];
  superTroopBoosts?: ActiveSuperTroopBoost[];
  magicItems?: Record<string, number>;
  activePotions?: ActivePotionBoost[];
  /** Recent simulated attacks against this village, newest first. */
  defenseLog?: DefenseLogEntry[];
  /** Last real-world timestamp at which an incoming defense was simulated. */
  lastDefenseAt?: number;
  starBonusStars?: number;
  // Optional: saves created before the statistics / achievement wiring lack these
  statistics?: GameStatistics;
  achievements?: AchievementProgress[];
  trophies: number;
  league: string;
  campaignProgress: CampaignProgress;
  obstacleCounter: number;
  lastSaveTimestamp: number;
  totalPlayTime: number;
  gameClockSpeed: number;
}
