import type React from 'react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Screen } from '../App.tsx';
import type {
  VillageState,
  PlacedWall,
  PlacedBuilding,
  ResourceAmounts,
} from '../types/village.ts';
import type { ResourceType } from '../types/common.ts';
import type { TroopData } from '../types/troops.ts';
import type { ClanState } from '../engine/clan-manager.ts';
import { VillageGrid } from './VillageGrid.tsx';
import { HUD } from './HUD.tsx';
import { BuildingPanel } from './BuildingPanel.tsx';
import { ShopPanel } from './ShopPanel.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import { SaveLoadPanel } from './SaveLoadPanel.tsx';
import { GemShopPanel } from './GemShopPanel.tsx';
import { ArmyPanel } from './ArmyPanel.tsx';
import { LabPanel } from './LabPanel.tsx';
import { ClanPanel } from './ClanPanel.tsx';
import { HeroPanel } from './HeroPanel.tsx';
import { AchievementPanel } from './AchievementPanel.tsx';
import { MagicItemsPanel } from './MagicItemsPanel.tsx';
import { SuperTroopPanel } from './SuperTroopPanel.tsx';
import { StatsPanel } from './StatsPanel.tsx';
import { DefenseLogPanel } from './DefenseLogPanel.tsx';
import { SpellPanel } from './SpellPanel.tsx';
import { ClanWarPanel } from './ClanWarPanel.tsx';
import { useVillage } from '../hooks/useVillage.ts';
import { useResources } from '../hooks/useResources.ts';
import { useAutoSave } from '../hooks/useAutoSave.ts';
import { createSaveManager } from '../engine/save-manager.ts';
import { createStarterVillage, startUpgrade } from '../engine/village-manager.ts';
import {
  getAvailableTroops,
  getCurrentHousingUsed,
  getMaxHousingSpace,
  trainTroop,
  removeTroop,
  getLabLevel,
} from '../engine/army-manager.ts';
import { getAllTroops } from '../data/loaders/troop-loader.ts';
import { createClan, removeCastleTroop } from '../engine/clan-manager.ts';
import { autoFillCastleTroops } from '../engine/cc-troops-manager.ts';
import {
  getMinTHForSiege,
  getWorkshopLevel,
  getAvailableSiegeMachines,
  getSiegeCapacity,
  getTrainedSiegeCount,
  trainSiegeMachine,
  removeSiegeMachine,
} from '../engine/siege-manager.ts';
import { claimReward } from '../engine/achievement-manager.ts';
import { withAchievementSync } from '../engine/achievement-sync.ts';
import { incrementStat, createStatistics } from '../engine/statistics-tracker.ts';
import {
  createNotification,
  pushNotification,
  tickNotifications,
  dismissNotification,
  nextNotificationId,
  type GameNotification,
  type NotificationKind,
} from '../engine/notification-manager.ts';
import { diffVillageNotifications } from '../engine/village-notifications.ts';
import { NotificationToasts } from './NotificationToasts.tsx';
import { LayoutPresetsPanel } from './LayoutPresetsPanel.tsx';
import {
  listLayoutPresets,
  saveLayoutPreset,
  loadLayoutPreset,
  deleteLayoutPreset,
  applyLayoutPreset,
  type LayoutPresetMeta,
} from '../engine/layout-presets.ts';
import { getDisarmedTraps, getTotalRearmCost, rearmAllTraps } from '../engine/trap-manager.ts';
import {
  getVillageInventory,
  applyVillageMagicItem,
  buyMagicItemWithGems,
} from '../engine/magic-items-manager.ts';
import {
  getVillageSuperTroopState,
  boostVillageSuperTroop,
  unboostVillageSuperTroop,
} from '../engine/super-troop-manager.ts';
import { getTreasury, getTreasuryCapacity, addToTreasury, collectTreasury } from '../engine/treasury-manager.ts';
import { getStarBonusStars, claimStarBonus } from '../engine/trophy-manager.ts';
import { LeaguePanel } from './LeaguePanel.tsx';
import type { GameStatistics } from '../engine/statistics-tracker.ts';
import {
  getMaxSpellCapacity,
  getCurrentSpellHousing,
  getAvailableSpells,
  trainSpell,
  removeSpell,
} from '../engine/spell-queue-manager.ts';
import {
  startWar,
  startBattlePhase,
  selectPlayerWarBase,
  getSelectableWarBases,
  getNextAttackerIndex,
  simulateNPCAttacks,
  endWar,
  calculateWarLoot,
} from '../engine/clan-war-manager.ts';
import {
  createWarLeagueState,
  applyWarResultToLeague,
  getWarLeagueLootMultiplier,
} from '../engine/war-league-manager.ts';
import { deductResources } from '../engine/village-helpers.ts';
import {
  getTownHallUpgradeCost,
  getNextTHUnlockSummary,
  isTownHallMaxLevel,
  canStartTownHallUpgrade,
  startTownHallUpgrade,
} from '../engine/upgrade-manager.ts';
import { wallData } from '../data/loaders/index.ts';
import type { OwnedHero } from '../types/village.ts';
import { startHeroUpgrade } from '../engine/hero-manager.ts';
import { upgradeOwnedEquipment } from '../engine/equipment-manager.ts';
import { upgradeOwnedPet, getPetHouseLevel } from '../engine/pet-manager.ts';
import { getOres, getBlacksmithLevel } from '../engine/ore-manager.ts';
import { simulateDefense } from '../engine/defense-simulator.ts';
import { canReloadDefenseAmmo, reloadDefenseAmmo } from '../engine/defense-ammo.ts';
import { getTroopResearchLevel, startResearch } from '../engine/research-manager.ts';

type ActivePanel =
  | 'none' | 'shop' | 'settings' | 'saveLoad' | 'gemShop'
  | 'army' | 'lab' | 'clan' | 'heroes' | 'achievements'
  | 'magicItems' | 'superTroops' | 'stats' | 'spells' | 'clanWar' | 'league'
  | 'layoutPresets' | 'defenseLog';

interface VillageScreenProps {
  onNavigate: (screen: Screen) => void;
  externalState?: VillageState;
  externalSetState?: React.Dispatch<React.SetStateAction<VillageState>>;
}

const saveManager = createSaveManager();

// -- Troop unlock hints (TH gating for the army panel) --

const TROOP_LOCK_CONFIG: Record<string, {
  barracks: string;
  field: 'barracksLevelRequired' | 'darkBarracksLevelRequired';
}> = {
  elixir: { barracks: 'Barracks', field: 'barracksLevelRequired' },
  dark_elixir: { barracks: 'Dark Barracks', field: 'darkBarracksLevelRequired' },
};

function getTroopUnlockHint(troop: TroopData, townHallLevel: number): string {
  if (troop.thUnlock > townHallLevel) {
    return `Unlocks at Town Hall ${troop.thUnlock}`;
  }
  const cfg = TROOP_LOCK_CONFIG[troop.type];
  const required = cfg ? troop[cfg.field] : undefined;
  if (cfg && required !== undefined) {
    return `Requires ${cfg.barracks} level ${required}`;
  }
  return 'Locked';
}

/** Why siege training is unavailable, or null when the Workshop is ready. */
function getSiegeUnlockHint(state: VillageState): string | null {
  if (state.townHallLevel < getMinTHForSiege()) {
    return `Unlocks at Town Hall ${getMinTHForSiege()}`;
  }
  if (getWorkshopLevel(state) === 0) return 'Requires a Workshop (build one in the Shop)';
  return null;
}

// -- Town Hall panel (TH progression) --

const TH_RESOURCE_KEYS: Record<string, keyof ResourceAmounts> = {
  'Gold': 'gold',
  'Elixir': 'elixir',
  'Dark Elixir': 'darkElixir',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

interface TownHallPanelProps {
  building: PlacedBuilding;
  townHallLevel: number;
  resources: ResourceAmounts;
  idleBuilders: number;
  canUpgrade: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}

function getTownHallBlockReason(
  props: Pick<TownHallPanelProps, 'building' | 'townHallLevel' | 'resources' | 'idleBuilders'>,
): string | null {
  const { building, townHallLevel, resources, idleBuilders } = props;
  if (building.isUpgrading) return null;

  const cost = getTownHallUpgradeCost(townHallLevel);
  if (!cost) return null;

  const key = TH_RESOURCE_KEYS[cost.resource] ?? 'gold';
  if (resources[key] < cost.cost) return `Not enough ${cost.resource}`;
  if (idleBuilders === 0) return 'No free builders';
  return null;
}

function TownHallPanel({
  building,
  townHallLevel,
  resources,
  idleBuilders,
  canUpgrade,
  onUpgrade,
  onClose,
}: TownHallPanelProps) {
  const maxLevel = isTownHallMaxLevel(townHallLevel);
  const upgradeCost = maxLevel ? null : getTownHallUpgradeCost(townHallLevel);
  const unlockSummary = maxLevel ? null : getNextTHUnlockSummary(townHallLevel);
  const blockReason = getTownHallBlockReason({ building, townHallLevel, resources, idleBuilders });

  const newUnlocks = unlockSummary
    ? [...unlockSummary.newBuildings, ...unlockSummary.newTraps, ...unlockSummary.newTroops,
       ...unlockSummary.newSpells, ...unlockSummary.newHeroes]
    : [];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 border-t-2 border-amber-500/60 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-amber-400">Town Hall</h3>
            <span className="text-sm px-2 py-0.5 rounded bg-slate-700 text-slate-300">
              Level {townHallLevel}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              Builders: {idleBuilders} free
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close panel"
          >
            x
          </button>
        </div>

        {/* Upgrade status / cost */}
        {building.isUpgrading && (
          <div className="text-sm text-amber-300 mb-3">
            Upgrading to Level {townHallLevel + 1}... {formatDuration(Math.ceil(building.upgradeTimeRemaining))} remaining
          </div>
        )}

        {maxLevel && !building.isUpgrading && (
          <div className="text-sm text-emerald-400 mb-3">
            Town Hall is at the maximum level.
          </div>
        )}

        {upgradeCost && !building.isUpgrading && (
          <div className="text-sm text-slate-400 mb-2">
            Upgrade to Level {townHallLevel + 1}:{' '}
            <span className="text-amber-300">
              {upgradeCost.cost.toLocaleString()} {upgradeCost.resource}
            </span>
            {' '}({formatDuration(upgradeCost.time)})
          </div>
        )}

        {/* Unlock preview for the next TH level */}
        {newUnlocks.length > 0 && !building.isUpgrading && (
          <div className="text-xs text-slate-400 mb-3">
            <span className="text-slate-500 uppercase tracking-wide mr-2">Unlocks:</span>
            {newUnlocks.map((name) => (
              <span
                key={name}
                className="inline-block mr-1 mb-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!maxLevel && (
            <button
              onClick={onUpgrade}
              disabled={!canUpgrade || building.isUpgrading}
              title={blockReason ?? undefined}
              className="px-4 py-1.5 rounded font-semibold text-sm transition-colors bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Upgrade
            </button>
          )}
          {blockReason && !building.isUpgrading && (
            <span className="text-xs text-red-400">{blockReason}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function VillageScreen({ onNavigate, externalState, externalSetState }: VillageScreenProps) {
  const {
    state,
    setState,
    selectedId,
    selectedBuilding,
    placementMode,
    upgradeCost,
    canUpgrade,
    builders,
    handleBuildingClick,
    handleRemove,
    handleClosePanel,
    startPlacement,
    startTrapPlacement,
    handlePlacementClick,
    cancelPlacement,
  } = useVillage(externalState, externalSetState);

  const { collect, collectAll, storageCaps } = useResources(state, setState);

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [gameSpeed, setGameSpeed] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Auto-save every 30 seconds; the callback drives the "Saved" indicator
  useAutoSave(state, 30_000, setLastSavedAt);

  // --- Toast notifications ---
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  const pushToast = useCallback((kind: NotificationKind, message: string) => {
    setNotifications((queue) => pushNotification(queue, createNotification(nextNotificationId(), kind, message)));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setNotifications((queue) => dismissNotification(queue, id));
  }, []);

  // Advance the toast queue on its own light clock (UI only, cleaned up on unmount)
  useEffect(() => {
    const id = setInterval(() => {
      setNotifications((queue) => tickNotifications(queue, 250));
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Emit toasts for meaningful village changes (upgrade complete, builder free,
  // storage full) by diffing the previous snapshot against the current one.
  const prevVillageRef = useRef(state);
  useEffect(() => {
    const prev = prevVillageRef.current;
    if (prev !== state) {
      for (const event of diffVillageNotifications(prev, state, storageCaps)) {
        pushToast(event.kind, event.message);
      }
      prevVillageRef.current = state;
    }
  }, [state, storageCaps, pushToast]);

  const openPanel = useCallback((panel: ActivePanel) => {
    setActivePanel(panel);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel('none');
  }, []);

  const handleBuildingInteract = (instanceId: string) => {
    const building = state.buildings.find((b) => b.instanceId === instanceId);
    if (building?.buildingType === 'resource_collector') {
      const uncollected = building.uncollectedResources ?? 0;
      if (uncollected > 0) {
        collect(instanceId);
        return;
      }
    }
    handleBuildingClick(instanceId);
  };

  const handleSave = useCallback((slotId: string) => {
    saveManager.save(state, slotId);
  }, [state]);

  const handleLoad = useCallback((slotId: string) => {
    const loaded = saveManager.load(slotId);
    if (loaded) setState(loaded);
    setActivePanel('none');
  }, [setState]);

  const handleDeleteSave = useCallback((slotId: string) => {
    saveManager.delete(slotId);
  }, []);

  const handleBuyResources = useCallback(
    (resourceType: 'gold' | 'elixir' | 'darkElixir', amount: number, gemCost: number) => {
      if (state.resources.gems < gemCost) {
        pushToast('error', 'Not enough gems');
        return;
      }
      setState((prev) => ({
        ...prev,
        resources: {
          ...prev.resources,
          [resourceType]: prev.resources[resourceType] + amount,
          gems: prev.resources.gems - gemCost,
        },
      }));
    },
    [state.resources.gems, setState, pushToast],
  );

  const handleResetProgress = useCallback(() => {
    setState(createStarterVillage());
    setActivePanel('none');
  }, [setState]);

  const handleChangeSpeed = useCallback((speed: number) => {
    setGameSpeed(speed);
    setState((prev) => ({ ...prev, gameClockSpeed: speed }));
  }, [setState]);

  // Clan state (persisted on the village state so it survives saves)
  const clan: ClanState | null = state.clan ?? null;

  const handleCreateClan = useCallback((name: string) => {
    setState((prev) => ({ ...prev, clan: createClan(name) }));
  }, [setState]);

  // Donate simulation: clanmates fill the castle with TH-appropriate troops
  const handleRequestCastleTroops = useCallback(() => {
    setState((prev) => (
      prev.clan ? { ...prev, clan: autoFillCastleTroops(prev.clan, prev.townHallLevel) } : prev
    ));
  }, [setState]);

  const handleRemoveCastleTroop = useCallback((troopName: string) => {
    setState((prev) => (
      prev.clan ? { ...prev, clan: removeCastleTroop(prev.clan, troopName) } : prev
    ));
  }, [setState]);

  // Army handlers
  const handleTrainTroop = useCallback((troopName: string) => {
    setState((prev) => {
      const trained = trainTroop(prev, troopName);
      if (!trained) return prev;
      const statistics = incrementStat(prev.statistics ?? createStatistics(), 'troopsTrained');
      return { ...trained, statistics };
    });
  }, [setState]);

  // Building upgrade with statistics: counts toward the Empire Builder
  // achievement and keeps achievement progress in sync.
  const handleBuildingUpgrade = useCallback(() => {
    if (!selectedBuilding || !canUpgrade) return;
    setState((prev) => {
      const upgraded = startUpgrade(prev, selectedBuilding.instanceId);
      if (!upgraded) return prev;
      const statistics = incrementStat(prev.statistics ?? createStatistics(), 'buildingsUpgraded');
      return withAchievementSync({ ...upgraded, statistics });
    });
  }, [selectedBuilding, canUpgrade, setState]);

  const handleRemoveTroop = useCallback((troopName: string) => {
    setState((prev) => removeTroop(prev, troopName) ?? prev);
  }, [setState]);

  // Siege machine handlers (Workshop training)
  const handleTrainSiege = useCallback((siegeName: string) => {
    setState((prev) => trainSiegeMachine(prev, siegeName) ?? prev);
  }, [setState]);

  const handleRemoveSiege = useCallback((siegeName: string) => {
    setState((prev) => removeSiegeMachine(prev, siegeName));
  }, [setState]);

  const handleResearch = useCallback((troopName: string) => {
    setState((prev) => startResearch(prev, troopName) ?? prev);
  }, [setState]);

  // Town Hall upgrade handler (completes via the normal upgrade tick pipeline)
  const handleTownHallUpgrade = useCallback(() => {
    setState((prev) => {
      const upgraded = startTownHallUpgrade(prev);
      if (!upgraded) return prev;
      const statistics = incrementStat(prev.statistics ?? createStatistics(), 'buildingsUpgraded');
      return withAchievementSync({ ...upgraded, statistics });
    });
  }, [setState]);

  // X-Bow targeting mode toggle (ground-only = 14 tiles, ground+air = 11.5)
  const handleToggleXBowMode = useCallback(() => {
    if (!selectedBuilding || selectedBuilding.buildingId !== 'X-Bow') return;
    const instanceId = selectedBuilding.instanceId;
    setState((prev) => ({
      ...prev,
      buildings: prev.buildings.map((b) => {
        if (b.instanceId !== instanceId) return b;
        const current = b.xbowMode ?? 'ground_and_air';
        return { ...b, xbowMode: current === 'ground_and_air' ? 'ground' : 'ground_and_air' };
      }),
    }));
  }, [selectedBuilding, setState]);

  const handleReloadDefenseAmmo = useCallback(() => {
    if (!selectedBuilding) return;
    const instanceId = selectedBuilding.instanceId;
    setState((prev) => reloadDefenseAmmo(prev, instanceId) ?? prev);
  }, [selectedBuilding, setState]);

  // Building move handler
  const handleMoveBuilding = useCallback(() => {
    if (!selectedBuilding || selectedBuilding.buildingId === 'Town Hall') return;
    // Remove the building and enter placement mode for it
    const buildingId = selectedBuilding.buildingId;
    const buildingType = selectedBuilding.buildingType;
    const instanceToMove = selectedBuilding.instanceId;
    setState((prev) => ({
      ...prev,
      buildings: prev.buildings.filter((b) => b.instanceId !== instanceToMove),
    }));
    handleClosePanel();
    startPlacement(buildingId, buildingType, { free: true });
  }, [selectedBuilding, setState, handleClosePanel, startPlacement]);

  // Trap placement: route through placement mode so the player picks the tile,
  // exactly like buildings. The engine deducts the build cost and enforces caps.
  const handleSelectTrap = useCallback((trapId: string) => {
    startTrapPlacement(trapId);
    setActivePanel('none');
  }, [startTrapPlacement]);

  // Rearm every trap that has fired, if the player can afford the total cost.
  const disarmedTraps = getDisarmedTraps(state.traps ?? []);
  const handleRearmTraps = useCallback(() => {
    const totals = getTotalRearmCost(state.traps ?? []);
    const entries = Object.entries(totals) as Array<[ResourceType, number]>;
    setState((prev) => {
      let resources = prev.resources;
      for (const [resource, amount] of entries) {
        const deducted = deductResources(resources, amount, resource);
        if (!deducted) return prev; // cannot afford: leave everything untouched
        resources = deducted;
      }
      return { ...prev, resources, traps: rearmAllTraps(prev.traps ?? []) };
    });
  }, [state.traps, setState]);

  const handleSimulateDefense = useCallback(() => {
    const outcome = simulateDefense(state);
    setState(outcome.village);
    const summary = `${outcome.entry.stars} stars, ${outcome.entry.destructionPercent}% destruction`;
    pushToast(
      outcome.entry.result === 'victory' ? 'success' : 'error',
      `${outcome.entry.result === 'victory' ? 'Defense won' : 'Defense lost'}: ${summary}`,
    );
  }, [state, setState, pushToast]);

  // Returning players receive one incoming raid after eight real-world hours.
  // The persisted timestamp prevents remounts from producing duplicate defenses.
  const autoDefenseCheckedRef = useRef(false);
  useEffect(() => {
    if (autoDefenseCheckedRef.current) return;
    const lastDefense = state.lastDefenseAt ?? state.lastSaveTimestamp;
    if (Date.now() - lastDefense < 8 * 60 * 60 * 1000) return;
    autoDefenseCheckedRef.current = true;
    const id = window.setTimeout(handleSimulateDefense, 0);
    return () => window.clearTimeout(id);
  }, [state.lastDefenseAt, state.lastSaveTimestamp, handleSimulateDefense]);

  // --- Layout presets (localStorage arrangement snapshots) ---
  const [layoutPresets, setLayoutPresets] = useState<LayoutPresetMeta[]>(() => listLayoutPresets());

  const handleSaveLayout = useCallback((name: string) => {
    const meta = saveLayoutPreset(name, state);
    if (!meta) {
      pushToast('error', 'Could not save layout (slots full)');
      return;
    }
    setLayoutPresets(listLayoutPresets());
    pushToast('success', `Saved layout "${meta.name}"`);
  }, [state, pushToast]);

  const handleLoadLayout = useCallback((id: string) => {
    const preset = loadLayoutPreset(id);
    if (!preset) return;
    setState((prev) => applyLayoutPreset(prev, preset));
    pushToast('info', `Loaded layout "${preset.name}"`);
  }, [setState, pushToast]);

  const handleDeleteLayout = useCallback((id: string) => {
    deleteLayoutPreset(id);
    setLayoutPresets(listLayoutPresets());
  }, []);

  // Wall placement handler
  const handleSelectWall = useCallback(() => {
    const wallLvl1 = wallData.levels[0];
    if (!wallLvl1) return;
    const wallCounter = (state.walls?.length ?? 0) + 1;
    const newWall: PlacedWall = {
      instanceId: `wall_${wallCounter}`,
      level: 1,
      gridX: Math.floor(Math.random() * 30) + 1,
      gridY: Math.floor(Math.random() * 30) + 1,
    };
    setState((prev) => {
      const newResources = deductResources(prev.resources, wallLvl1.upgradeCost, wallLvl1.upgradeResource);
      if (!newResources) return prev;
      return {
        ...prev,
        resources: newResources,
        walls: [...(prev.walls ?? []), newWall],
      };
    });
    setActivePanel('none');
  }, [state.walls, setState]);

  // Hero handlers
  const handleUpdateHero = useCallback((heroName: string, updatedHero: OwnedHero) => {
    setState((prev) => ({
      ...prev,
      heroes: prev.heroes.map((h) => (h.name === heroName ? updatedHero : h)),
    }));
  }, [setState]);

  const handleUpgradeHero = useCallback((heroName: string) => {
    setState((prev) => {
      const hero = prev.heroes.find((h) => h.name === heroName);
      if (!hero) return prev;
      const result = startHeroUpgrade(hero, prev.resources);
      if (!result) return prev;
      return {
        ...prev,
        resources: result.resources,
        heroes: prev.heroes.map((h) => (h.name === heroName ? result.hero : h)),
      };
    });
  }, [setState]);

  const handleUpgradeEquipment = useCallback((equipmentName: string) => {
    setState((prev) => {
      const result = upgradeOwnedEquipment(
        prev.ownedEquipment ?? [],
        equipmentName,
        getOres(prev),
        getBlacksmithLevel(prev.buildings),
      );
      if (!result) return prev;
      return { ...prev, ownedEquipment: result.equipment, ores: result.remainingOres };
    });
  }, [setState]);

  const handleUpgradePet = useCallback((petName: string) => {
    setState((prev) => {
      const result = upgradeOwnedPet(prev.ownedPets ?? [], petName, prev.resources.darkElixir);
      if (!result) return prev;
      return {
        ...prev,
        ownedPets: result.pets,
        resources: { ...prev.resources, darkElixir: prev.resources.darkElixir - result.cost },
      };
    });
  }, [setState]);

  // Achievements are DERIVED from persisted statistics, trophies, and campaign
  // stars, so progress survives reloads. Only claimedTier is stored explicitly.
  const achievementProgress = useMemo(() => withAchievementSync(state).achievements ?? [], [state]);

  const handleClaimAchievement = useCallback((achievementId: string) => {
    // Claim against freshly synced progress so newly reached tiers are eligible.
    // Computed outside the updater; updaters must stay pure (StrictMode double-
    // invokes them, which would otherwise double-award gems).
    const result = claimReward(withAchievementSync(state).achievements ?? [], achievementId);
    if (result.gemsEarned <= 0) return;
    setState((vs) => ({
      ...vs,
      achievements: result.progress,
      resources: { ...vs.resources, gems: vs.resources.gems + result.gemsEarned },
    }));
    pushToast('success', `Claimed ${result.gemsEarned} gems`);
  }, [state, setState, pushToast]);

  // Magic items live on the village state so they persist through saves.
  // Using an item applies its real effect; it is only consumed on success.
  const handleUseMagicItem = useCallback((itemId: string) => {
    setState((prev) => applyVillageMagicItem(prev, itemId) ?? prev);
  }, [setState]);

  const handleBuyMagicItem = useCallback((itemId: string) => {
    setState((prev) => buyMagicItemWithGems(prev, itemId) ?? prev);
  }, [setState]);

  // Super troop boosts live on the village state; timers tick with the game clock
  const handleBoostSuperTroop = useCallback((superTroopName: string) => {
    setState((prev) => boostVillageSuperTroop(prev, superTroopName) ?? prev);
  }, [setState]);

  const handleUnboostSuperTroop = useCallback((superTroopName: string) => {
    setState((prev) => unboostVillageSuperTroop(prev, superTroopName));
  }, [setState]);

  // League, star bonus, and treasury handlers
  const handleClaimStarBonus = useCallback(() => {
    setState((prev) => claimStarBonus(prev)?.state ?? prev);
  }, [setState]);

  const handleCollectTreasury = useCallback(() => {
    setState((prev) => collectTreasury(prev));
  }, [setState]);

  // Statistics
  const [stats] = useState<GameStatistics>(createStatistics);

  // Spell handlers
  const handleTrainSpell = useCallback((spellName: string) => {
    setState((prev) => trainSpell(prev, spellName) ?? prev);
  }, [setState]);

  const handleRemoveSpell = useCallback((spellName: string) => {
    setState((prev) => removeSpell(prev, spellName));
  }, [setState]);

  // Clan war state and handlers (persisted on the village state)
  const warState = state.war ?? null;
  const warLeague = state.warLeague ?? createWarLeagueState();

  const handleStartWar = useCallback((warSize: number) => {
    if (!clan) return;
    // War rosters use Math.random, so build the state outside the updater
    const playerTHLevels = Array.from({ length: warSize }, () => state.townHallLevel);
    const war = startWar(clan.name, playerTHLevels, warSize);
    setState((prev) => ({ ...prev, war }));
  }, [clan, state.townHallLevel, setState]);

  const handleSelectWarBase = useCallback((baseId: string) => {
    setState((prev) => (
      prev.war ? { ...prev, war: selectPlayerWarBase(prev.war, baseId) } : prev
    ));
  }, [setState]);

  const handleStartBattleDay = useCallback(() => {
    if (!warState || warState.phase !== 'preparation') return;
    // Enemy attacks are rolled once when battle day begins (outside the updater;
    // updaters must stay pure and the simulation uses Math.random)
    const war = simulateNPCAttacks(startBattlePhase(warState));
    setState((prev) => ({ ...prev, war }));
  }, [warState, setState]);

  const handleWarAttack = useCallback((defenderIndex: number) => {
    if (!warState || warState.phase !== 'battle') return;
    if (getNextAttackerIndex(warState) < 0) return;
    // The attack is fought as a real battle against the enemy war base;
    // App routes the pending attack into the battle screen and records the result
    setState((prev) => ({ ...prev, pendingWarAttack: { defenderIndex } }));
    onNavigate('battle');
  }, [warState, setState, onNavigate]);

  const handleEndWar = useCallback(() => {
    if (!warState || warState.phase === 'ended') return;
    const { war, result } = endWar(warState);
    // War loot lands in the treasury (protected pool), scaled by the war league
    const loot = calculateWarLoot(result, state.townHallLevel, getWarLeagueLootMultiplier(warLeague.tierIndex));
    const leagueChange = applyWarResultToLeague(warLeague, result);
    setState((prev) => ({
      ...addToTreasury(prev, loot),
      war: { ...war, lootAwarded: loot },
      warLeague: leagueChange.league,
    }));
  }, [warState, warLeague, state.townHallLevel, setState]);

  const handleStartNewWar = useCallback(() => {
    setState((prev) => (
      prev.war?.phase === 'ended' ? { ...prev, war: undefined } : prev
    ));
  }, [setState]);

  // Count walls and traps for the shop panel
  const wallCount = state.walls?.length ?? 0;
  const trapCounts: Record<string, number> = {};
  for (const trap of state.traps ?? []) {
    trapCounts[trap.trapId] = (trapCounts[trap.trapId] ?? 0) + 1;
  }

  // TH-gated troop availability for the army panel
  const availableTroops = getAvailableTroops(state);
  const lockedTroops = getAllTroops()
    .filter((t) => !availableTroops.some((a) => a.name === t.name))
    .map((t) => ({
      name: t.name,
      housingSpace: t.housingSpace,
      unlockHint: getTroopUnlockHint(t, state.townHallLevel),
    }));

  const selectedIsTownHall = selectedBuilding?.buildingId === 'Town Hall';

  return (
    <div className="relative min-h-screen bg-slate-900 overflow-hidden">
      <NotificationToasts notifications={notifications} onDismiss={dismissToast} />
      <HUD
        resources={state.resources}
        storageCaps={storageCaps}
        builders={builders}
        townHallLevel={state.townHallLevel}
        trophies={state.trophies}
        league={state.league}
        onOpenLeague={() => openPanel('league')}
        onCollectAll={collectAll}
      />

      <div className="pt-14 pb-4 flex flex-col items-center">
        <VillageGrid
          state={state}
          onBuildingClick={handleBuildingInteract}
          selectedBuilding={selectedId}
          placementMode={placementMode}
          onPlacementClick={handlePlacementClick}
        />

        {/* Main action buttons */}
        <div className="flex gap-2 mt-4 flex-wrap justify-center">
          <button
            onClick={() => openPanel('shop')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Shop
          </button>
          <button
            onClick={() => onNavigate('battle')}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Attack
          </button>
          <button
            onClick={() => openPanel('defenseLog')}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg font-semibold text-sm transition-colors"
          >
            Defense Log
          </button>
          <button
            onClick={() => onNavigate('campaign')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Campaign
          </button>
          <button
            onClick={() => openPanel('army')}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Army
          </button>
          <button
            onClick={() => openPanel('lab')}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Lab
          </button>
          <button
            onClick={() => openPanel('clan')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Clan
          </button>
          <button
            onClick={() => openPanel('spells')}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Spells
          </button>
          <button
            onClick={() => openPanel('heroes')}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Heroes
          </button>
          <button
            onClick={() => openPanel('superTroops')}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Super Troops
          </button>
          <button
            onClick={() => openPanel('clanWar')}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg font-semibold text-sm transition-colors"
          >
            Clan War
          </button>
          <button
            onClick={() => openPanel('league')}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg font-semibold text-sm transition-colors"
          >
            League
          </button>
          <button
            onClick={() => openPanel('achievements')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Achievements
          </button>
          <button
            onClick={() => openPanel('magicItems')}
            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Magic Items
          </button>
          <button
            onClick={() => openPanel('stats')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Stats
          </button>
          <button
            onClick={() => openPanel('gemShop')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Gem Shop
          </button>
          <button
            onClick={() => openPanel('layoutPresets')}
            className="px-4 py-2 bg-lime-600 hover:bg-lime-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Layouts
          </button>
          <button
            onClick={() => openPanel('saveLoad')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Save/Load
          </button>
          <button
            onClick={() => openPanel('settings')}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Settings
          </button>
          <button
            onClick={() => onNavigate('menu')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold text-sm transition-colors"
          >
            Menu
          </button>
        </div>

        {placementMode && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-amber-300">
              Placing: {placementMode.buildingId}
            </span>
            <span className="text-slate-400">Click on the grid to place</span>
            <button
              onClick={cancelPlacement}
              className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Status row: autosave indicator + trap rearm */}
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${lastSavedAt ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            {lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Not yet saved'}
          </span>
          {disarmedTraps.length > 0 && (
            <button
              onClick={handleRearmTraps}
              className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-white font-semibold transition-colors"
            >
              Rearm {disarmedTraps.length} trap{disarmedTraps.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {selectedBuilding && selectedIsTownHall && (
        <TownHallPanel
          building={selectedBuilding}
          townHallLevel={state.townHallLevel}
          resources={state.resources}
          idleBuilders={builders.idle}
          canUpgrade={canStartTownHallUpgrade(state)}
          onUpgrade={handleTownHallUpgrade}
          onClose={handleClosePanel}
        />
      )}

      {selectedBuilding && !selectedIsTownHall && (
        <BuildingPanel
          building={selectedBuilding}
          onUpgrade={handleBuildingUpgrade}
          onMove={handleMoveBuilding}
          onRemove={handleRemove}
          onClose={handleClosePanel}
          canUpgrade={canUpgrade}
          upgradeCost={upgradeCost}
          onToggleXBowMode={handleToggleXBowMode}
          onReloadAmmo={handleReloadDefenseAmmo}
          canReloadAmmo={canReloadDefenseAmmo(state, selectedBuilding.instanceId)}
        />
      )}

      {activePanel === 'shop' && (
        <ShopPanel
          townHallLevel={state.townHallLevel}
          placedBuildings={state.buildings}
          resources={state.resources}
          wallCount={wallCount}
          trapCounts={trapCounts}
          onSelectBuilding={(id, type) => {
            startPlacement(id, type);
            setActivePanel('none');
          }}
          onSelectTrap={handleSelectTrap}
          onSelectWall={handleSelectWall}
          onClose={closePanel}
        />
      )}

      {activePanel === 'settings' && (
        <SettingsPanel
          gameSpeed={gameSpeed}
          onChangeSpeed={handleChangeSpeed}
          onResetProgress={handleResetProgress}
          onClose={closePanel}
        />
      )}

      {activePanel === 'saveLoad' && (
        <SaveLoadPanel
          slots={saveManager.listSlots()}
          onSave={handleSave}
          onLoad={handleLoad}
          onDelete={handleDeleteSave}
          onClose={closePanel}
        />
      )}

      {activePanel === 'gemShop' && (
        <GemShopPanel
          gems={state.resources.gems}
          onBuyResources={handleBuyResources}
          onClose={closePanel}
        />
      )}

      {activePanel === 'army' && (
        <ArmyPanel
          army={state.army}
          availableTroops={availableTroops}
          lockedTroops={lockedTroops}
          housingUsed={getCurrentHousingUsed(state)}
          housingMax={getMaxHousingSpace(state)}
          resources={state.resources}
          siegeMachines={state.siegeMachines ?? []}
          availableSieges={getAvailableSiegeMachines(state)}
          siegeCapacityUsed={getTrainedSiegeCount(state)}
          siegeCapacityMax={getSiegeCapacity(state)}
          siegeUnlockHint={getSiegeUnlockHint(state)}
          onTrain={handleTrainTroop}
          onRemove={handleRemoveTroop}
          onTrainSiege={handleTrainSiege}
          onRemoveSiege={handleRemoveSiege}
          onClose={closePanel}
        />
      )}

      {activePanel === 'lab' && (
        <LabPanel
          labLevel={getLabLevel(state)}
          troops={getAllTroops()}
          troopLevels={Object.fromEntries(getAllTroops().map((troop) => [
            troop.name,
            getTroopResearchLevel(state, troop.name),
          ]))}
          resources={state.resources}
          activeResearch={state.activeResearch ?? null}
          onResearch={handleResearch}
          onClose={closePanel}
        />
      )}

      {activePanel === 'clan' && (
        <ClanPanel
          clan={clan}
          townHallLevel={state.townHallLevel}
          onCreateClan={handleCreateClan}
          onRequestTroops={handleRequestCastleTroops}
          onRemoveCastleTroop={handleRemoveCastleTroop}
          onClose={closePanel}
        />
      )}

      {activePanel === 'heroes' && (
        <HeroPanel
          heroes={state.heroes}
          townHallLevel={state.townHallLevel}
          ores={getOres(state)}
          ownedEquipment={state.ownedEquipment ?? []}
          ownedPets={state.ownedPets ?? []}
          blacksmithLevel={getBlacksmithLevel(state.buildings)}
          petHouseLevel={getPetHouseLevel(state.buildings)}
          resources={state.resources}
          onUpdateHero={handleUpdateHero}
          onUpgradeHero={handleUpgradeHero}
          onUpgradeEquipment={handleUpgradeEquipment}
          onUpgradePet={handleUpgradePet}
          onClose={closePanel}
        />
      )}

      {activePanel === 'achievements' && (
        <AchievementPanel
          progress={achievementProgress}
          onClaimReward={handleClaimAchievement}
          onClose={closePanel}
        />
      )}

      {activePanel === 'magicItems' && (
        <MagicItemsPanel
          inventory={getVillageInventory(state)}
          gems={state.resources.gems}
          onUseItem={handleUseMagicItem}
          onBuyItem={handleBuyMagicItem}
          onClose={closePanel}
        />
      )}

      {activePanel === 'superTroops' && (
        <SuperTroopPanel
          superTroopState={getVillageSuperTroopState(state)}
          townHallLevel={state.townHallLevel}
          darkElixir={state.resources.darkElixir}
          onBoost={handleBoostSuperTroop}
          onUnboost={handleUnboostSuperTroop}
          onClose={closePanel}
        />
      )}

      {activePanel === 'league' && (
        <LeaguePanel
          league={state.league}
          trophies={state.trophies}
          starBonusStars={getStarBonusStars(state)}
          treasury={getTreasury(state)}
          treasuryCapacity={getTreasuryCapacity(state.townHallLevel)}
          onClaimStarBonus={handleClaimStarBonus}
          onCollectTreasury={handleCollectTreasury}
          onClose={closePanel}
        />
      )}

      {activePanel === 'stats' && (
        <StatsPanel
          stats={state.statistics ?? stats}
          onClose={closePanel}
        />
      )}

      {activePanel === 'defenseLog' && (
        <DefenseLogPanel
          entries={state.defenseLog ?? []}
          onSimulate={handleSimulateDefense}
          onClose={closePanel}
        />
      )}

      {activePanel === 'layoutPresets' && (
        <LayoutPresetsPanel
          presets={layoutPresets}
          onSave={handleSaveLayout}
          onLoad={handleLoadLayout}
          onDelete={handleDeleteLayout}
          onClose={closePanel}
        />
      )}

      {activePanel === 'spells' && (
        <SpellPanel
          spells={state.spells}
          availableSpells={getAvailableSpells(state).map((s) => ({
            name: s.name,
            housingSpace: s.housingSpace,
            cost: s.levels[0]?.upgradeCost ?? 0,
            costResource: s.levels[0]?.upgradeResource ?? 'Elixir',
          }))}
          spellCapacityUsed={getCurrentSpellHousing(state)}
          spellCapacityMax={getMaxSpellCapacity(state)}
          resources={state.resources}
          onTrainSpell={handleTrainSpell}
          onRemoveSpell={handleRemoveSpell}
          onClose={closePanel}
        />
      )}

      {activePanel === 'clanWar' && (
        <ClanWarPanel
          war={warState}
          clanName={clan?.name ?? null}
          townHallLevel={state.townHallLevel}
          warLeague={warLeague}
          availableWarBases={getSelectableWarBases(state.townHallLevel)}
          onStartWar={handleStartWar}
          onStartBattle={handleStartBattleDay}
          onSelectWarBase={handleSelectWarBase}
          onAttack={handleWarAttack}
          onEndWar={handleEndWar}
          onStartNewWar={handleStartNewWar}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
