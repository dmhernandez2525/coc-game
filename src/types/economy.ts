export interface StorageLootTier {
  townHallLevel: number;
  percentStealable: number;
  lootCap: number;
  note?: string;
}

export interface LootPenaltyTier {
  thDifference: string;
  lootMultiplier: number;
  note?: string;
}

export interface LeagueTier {
  league: string;
  trophyRange: string;
  maxBonusGold: number;
  maxBonusElixir: number;
  maxBonusDarkElixir: number;
}

export interface ShieldState {
  isActive: boolean;
  remainingDuration: number;
  type: 'magic' | 'purchased' | 'legend' | 'none';
}

export interface GemSpeedUpBreakpoint {
  duration: string;
  seconds: number;
  gemCost: number;
}
