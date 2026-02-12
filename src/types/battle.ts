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
  baseDps: number;
  attackRange: number;
  movementSpeed: number;
  isFlying: boolean;
  // Special troop mechanics
  isBurrowed?: boolean;           // Miner: untargetable while moving underground
  isEnraged?: boolean;            // Baby Dragon: alone in the sky
  healingNerfed?: boolean;        // Healer: 50% heal penalty on heroes
  selfDestructs?: boolean;        // Wall Breaker: dies on impact
  wallDamageMultiplier?: number;  // Wall Breaker: 40x to walls
  resourceDamageMultiplier?: number; // Goblin: 2x to resource buildings
  deathSpawnName?: string;        // Golem -> Golemite, Lava Hound -> Lava Pup
  deathSpawnCount?: number;
  deathDamage?: number;           // Balloon: splash damage on death
  deathDamageRadius?: number;
  splashRadius?: number;          // Valkyrie: 360 degree attack radius
  chainTargets?: number;          // Electro Dragon: chain lightning bounces
  chainDamageDecay?: number;      // Electro Dragon: damage decay per bounce
  healPerSecond?: number;         // Healer: healing output
  healRadius?: number;
  isHero?: boolean;               // Hero flag
  heroAbilityUsed?: boolean;
  canJumpWalls?: boolean;         // Hog Rider, Royal Champion: ignore walls
  jumpSpellActive?: boolean;      // Troop is inside a Jump Spell radius
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
  baseDps: number;
  range: { min: number; max: number };
  attackSpeed: number;
  lastAttackTime: number;
  isDestroyed: boolean;
  // Special defense state
  infernoRampTime?: number;       // Inferno Tower (single): seconds on current target
  infernoMode?: 'single' | 'multi';
  infernoMaxTargets?: number;     // Inferno Tower (multi): max simultaneous targets
  isHidden?: boolean;             // Hidden Tesla: invisible until triggered
  revealTriggerRange?: number;    // Hidden Tesla: reveal range
  deathDamage?: number;           // Bomb Tower: explosion on destruction
  deathDamageRadius?: number;
  pushbackStrength?: number;      // Air Sweeper: pushback instead of damage
  pushbackArc?: number;           // Air Sweeper: cone angle in degrees
  splashRadius?: number;          // Mortar, Wizard Tower: area damage
  eagleActivationThreshold?: number; // Eagle Artillery: housing deployed to activate
  eagleActivated?: boolean;
  isFrozen?: boolean;             // Freeze spell applied
  frozenUntil?: number;           // Elapsed time when freeze ends
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
  earthquakeHitCount?: number;    // Tracks successive Earthquake hits for diminishing returns
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
