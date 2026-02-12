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

export interface VillageObstacle {
  instanceId: string;
  type: string;
  gridX: number;
  gridY: number;
  removalCost: number;
  removalTime: number;
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
  trophies: number;
  league: string;
  campaignProgress: CampaignProgress;
  obstacleCounter: number;
  lastSaveTimestamp: number;
  totalPlayTime: number;
  gameClockSpeed: number;
}
