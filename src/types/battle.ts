export type BattlePhase = 'scout' | 'active' | 'ended';
export type TroopState = 'idle' | 'moving' | 'attacking' | 'dead';

export interface DeployedTroop {
  id: string;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  x: number;
  y: number;
  targetId: string | null;
  state: TroopState;
  dps: number;
  attackRange: number;
  movementSpeed: number;
  isFlying: boolean;
}

export interface ActiveDefense {
  buildingInstanceId: string;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  x: number;
  y: number;
  targetTroopId: string | null;
  dps: number;
  range: { min: number; max: number };
  attackSpeed: number;
  lastAttackTime: number;
  isDestroyed: boolean;
}

export interface BattleBuilding {
  instanceId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  x: number;
  y: number;
  isDestroyed: boolean;
  weight: number;
}

export interface ActiveSpell {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  radius: number;
  remainingDuration: number;
  totalDuration: number;
}

export interface BattleResult {
  stars: number;
  destructionPercent: number;
  loot: {
    gold: number;
    elixir: number;
    darkElixir: number;
  };
  trophyChange: number;
  timeUsed: number;
}

export interface BattleState {
  phase: BattlePhase;
  timeRemaining: number;
  destructionPercent: number;
  stars: number;
  deployedTroops: DeployedTroop[];
  defenses: ActiveDefense[];
  buildings: BattleBuilding[];
  spells: ActiveSpell[];
  loot: {
    gold: number;
    elixir: number;
    darkElixir: number;
  };
  availableTroops: Array<{ name: string; level: number; count: number }>;
  availableSpells: Array<{ name: string; level: number; count: number }>;
}
