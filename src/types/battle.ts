import type { TargetType, XBowMode } from './common';

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
  housingSpace?: number;          // Real army capacity used for Eagle activation
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
  isDefender?: boolean;           // Defender-owned troop (e.g. defensive CC troops)
  baseMovementSpeed?: number;     // Unbuffed movement speed (captured by the spell engine)
  preSpellMovementSpeed?: number;
  preSpellDps?: number;           // DPS before spell buffs; restored when buffs lapse
  invisibleUntil?: number;        // Elapsed seconds when hero cloak invisibility ends
  invincibleUntil?: number;       // Grand Warden Eternal Tome: takes no damage until this elapsed second
  isClone?: boolean;              // Clone Spell copy
  cloneLifespanRemaining?: number; // Clone Spell: seconds before the copy expires
  isPet?: boolean;                // Hero pet deployed alongside its hero
  isSiegeMachine?: boolean;       // Siege machine: paths to the Town Hall, ignores defenders
  carriedTroops?: Array<{ name: string; level: number; count: number }>; // CC troops riding in a siege
  ownerHeroName?: string;
  petAbilityReadyAt?: number;
  petAbilityConsumed?: boolean;
  petRageUntil?: number;
  frostmitesPerSummon?: number;
  maxFrostmites?: number;
  stunDuration?: number;
  diggySurfaceArmed?: boolean;
  poisonDps?: number;
  poisonSpeedMultiplier?: number;
  poisonAttackMultiplier?: number;
  phoenixReviveDuration?: number;
  spiritWalkDuration?: number;
  spiritWalkCooldown?: number;
  boogersPerSummon?: number;
  maxBoogers?: number;
  targetsBuildingsOnly?: boolean;
  favoriteTargetOverride?: string;
  attackRateMultiplier?: number;
  preSpellAttackRateMultiplier?: number;
  poisonedUntil?: number;
  poisonDamagePerSecond?: number;
  lifeAuraBoostPercent?: number;
  lifeAuraRadius?: number;
  lifeAuraBaseMaxHp?: number;
  lifeAuraApplied?: boolean;
  favoriteTargetOverrideUntil?: number;
  brainwashDuration?: number;
  isFrozen?: boolean;             // Freeze Spell prevents defender movement/attacks
  frozenUntil?: number;           // Battle elapsed second when the freeze expires
  frostSlowUntil?: number;
  preFrostMovementSpeed?: number;
  preFrostAttackRateMultiplier?: number;
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
  frostSlowUntil?: number;
  preFrostAttackSpeed?: number;
  targetType?: TargetType;        // Air/ground targeting legality from defense data
  xbowMode?: XBowMode;            // X-Bow: ground-only (14 tiles) or ground+air (11.5 tiles)
  scatterSplashDamage?: number;   // Scattershot: shrapnel damage behind the impact point
  scatterSplashRadius?: number;   // Scattershot: shrapnel spread radius around the target
  ammo?: number;
  maxAmmo?: number;
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
  storedLoot?: LootBundle;        // Loot awarded to the attacker when this building falls
}

export interface LootBundle {
  gold: number;
  elixir: number;
  darkElixir: number;
}

/** Stat boosts a hero carries into battle from its equipped items. */
export interface HeroBattleBoost {
  hitpointIncrease: number;   // Flat HP added to the hero
  dpsIncrease: number;        // Flat DPS added to the hero
  dpsMultiplier: number;      // Multiplier from percentage damage stats (1 = none)
  speedIncrease: number;      // Flat movement speed added to the hero
}

/** Pet assigned to an attacker hero, deployed alongside it. */
export interface PetAssignment {
  name: string;
  level: number;
  recalledTroop?: DeployedTroop;
}

/** Hero the attacker can still deploy this battle (one deploy per hero). */
export interface AvailableHero {
  name: string;
  level: number;
  deployed: boolean;
  boost?: HeroBattleBoost;
  pet?: PetAssignment;
  recalledTroop?: DeployedTroop;
}

/** Defender clan castle garrison waiting to deploy when attackers come near. */
export interface DefenderCCState {
  troops: Array<{ name: string; level: number; count: number }>;
  x: number;
  y: number;
  deployed: boolean;
}

/** Attacker clan castle troops available for one offensive deploy per battle. */
export interface AttackerCCState {
  troops: Array<{ name: string; level: number; count: number }>;
  deployed: boolean;
}

/** Siege machine the attacker brought (one per attack). */
export interface AvailableSiege {
  name: string;
  level: number;
  deployed: boolean;
}

/** Post-battle status of an attacker hero, used for recovery timers. */
export interface HeroBattleStatus {
  name: string;
  level: number;
  remainingHp: number;
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
  remainingCloneCapacity?: number;
  clonedSourceIds?: string[];
  cloneLifespan?: number;
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
  heroesDeployed?: HeroBattleStatus[];
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
  availableHeroes?: AvailableHero[];
  defenderCC?: DefenderCCState;
  attackerCC?: AttackerCCState;
  attackerSiege?: AvailableSiege;
}
