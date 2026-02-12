import type React from 'react';
import { useState, useCallback } from 'react';
import type { Screen } from '../App.tsx';
import type { VillageState, PlacedWall, PlacedTrap } from '../types/village.ts';
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
import { SpellPanel } from './SpellPanel.tsx';
import { ClanWarPanel } from './ClanWarPanel.tsx';
import { useVillage } from '../hooks/useVillage.ts';
import { useResources } from '../hooks/useResources.ts';
import { useAutoSave } from '../hooks/useAutoSave.ts';
import { createSaveManager } from '../engine/save-manager.ts';
import { createStarterVillage } from '../engine/village-manager.ts';
import {
  getAvailableTroops,
  getCurrentHousingUsed,
  getMaxHousingSpace,
  trainTroop,
  removeTroop,
  getLabLevel,
} from '../engine/army-manager.ts';
import { getAllTroops } from '../data/loaders/troop-loader.ts';
import { createClan } from '../engine/clan-manager.ts';
import type { AchievementProgress } from '../engine/achievement-manager.ts';
import { claimReward } from '../engine/achievement-manager.ts';
import type { MagicItemInventory } from '../engine/magic-items-manager.ts';
import { createInventory, useBookOfBuilding, useRune } from '../engine/magic-items-manager.ts';
import type { SuperTroopState } from '../engine/super-troop-manager.ts';
import {
  createSuperTroopState,
  boostSuperTroop,
  unboostSuperTroop,
} from '../engine/super-troop-manager.ts';
import type { GameStatistics } from '../engine/statistics-tracker.ts';
import { createStatistics } from '../engine/statistics-tracker.ts';
import {
  getMaxSpellCapacity,
  getCurrentSpellHousing,
  getAvailableSpells,
  trainSpell,
  removeSpell,
} from '../engine/spell-queue-manager.ts';
import type { WarState } from '../engine/clan-war-manager.ts';
import {
  startWar,
  startBattlePhase,
  recordPlayerAttack,
  simulateNPCAttacks,
  endWar,
} from '../engine/clan-war-manager.ts';
import type { OwnedHero } from '../types/village.ts';

type ActivePanel =
  | 'none' | 'shop' | 'settings' | 'saveLoad' | 'gemShop'
  | 'army' | 'lab' | 'clan' | 'heroes' | 'achievements'
  | 'magicItems' | 'superTroops' | 'stats' | 'spells' | 'clanWar';

interface VillageScreenProps {
  onNavigate: (screen: Screen) => void;
  externalState?: VillageState;
  externalSetState?: React.Dispatch<React.SetStateAction<VillageState>>;
}

const saveManager = createSaveManager();

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
    handleUpgrade,
    handleRemove,
    handleClosePanel,
    startPlacement,
    handlePlacementClick,
    cancelPlacement,
  } = useVillage(externalState, externalSetState);

  const { collect, collectAll, storageCaps } = useResources(state, setState);

  // Auto-save every 30 seconds
  useAutoSave(state);

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [gameSpeed, setGameSpeed] = useState(1);

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
      if (state.resources.gems < gemCost) return;
      setState((prev) => ({
        ...prev,
        resources: {
          ...prev.resources,
          [resourceType]: prev.resources[resourceType] + amount,
          gems: prev.resources.gems - gemCost,
        },
      }));
    },
    [state.resources.gems, setState],
  );

  const handleResetProgress = useCallback(() => {
    setState(createStarterVillage());
    setActivePanel('none');
  }, [setState]);

  const handleChangeSpeed = useCallback((speed: number) => {
    setGameSpeed(speed);
    setState((prev) => ({ ...prev, gameClockSpeed: speed }));
  }, [setState]);

  // Clan state (lives alongside village state for simplicity)
  const [clan, setClan] = useState<ClanState | null>(null);

  const handleCreateClan = useCallback((name: string) => {
    setClan(createClan(name));
  }, []);

  // Army handlers
  const handleTrainTroop = useCallback((troopName: string) => {
    setState((prev) => trainTroop(prev, troopName) ?? prev);
  }, [setState]);

  const handleRemoveTroop = useCallback((troopName: string) => {
    setState((prev) => removeTroop(prev, troopName) ?? prev);
  }, [setState]);

  // Lab handler (simplified: instant research for now)
  const handleResearch = useCallback((troopName: string) => {
    setState((prev) => {
      const troopIdx = prev.army.findIndex((t) => t.name === troopName);
      if (troopIdx < 0) return prev;
      const newArmy = [...prev.army];
      newArmy[troopIdx] = { ...newArmy[troopIdx], level: newArmy[troopIdx].level + 1 };
      return { ...prev, army: newArmy };
    });
  }, [setState]);

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
    startPlacement(buildingId, buildingType);
  }, [selectedBuilding, setState, handleClosePanel, startPlacement]);

  // Trap placement handler
  const handleSelectTrap = useCallback((trapId: string) => {
    let trapCounter = (state.traps?.length ?? 0) + 1;
    const newTrap: PlacedTrap = {
      instanceId: `trap_${trapCounter++}`,
      trapId,
      level: 1,
      gridX: Math.floor(Math.random() * 28) + 2,
      gridY: Math.floor(Math.random() * 28) + 2,
      isArmed: true,
    };
    setState((prev) => ({
      ...prev,
      traps: [...(prev.traps ?? []), newTrap],
    }));
    setActivePanel('none');
  }, [state.traps, setState]);

  // Wall placement handler
  const handleSelectWall = useCallback(() => {
    let wallCounter = (state.walls?.length ?? 0) + 1;
    const newWall: PlacedWall = {
      instanceId: `wall_${wallCounter++}`,
      level: 1,
      gridX: Math.floor(Math.random() * 30) + 1,
      gridY: Math.floor(Math.random() * 30) + 1,
    };
    setState((prev) => ({
      ...prev,
      walls: [...(prev.walls ?? []), newWall],
    }));
    setActivePanel('none');
  }, [state.walls, setState]);

  // Hero handler
  const handleUpdateHero = useCallback((heroName: string, updatedHero: OwnedHero) => {
    setState((prev) => ({
      ...prev,
      heroes: prev.heroes.map((h) => (h.name === heroName ? updatedHero : h)),
    }));
  }, [setState]);

  // Achievement state and handlers
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress[]>([]);

  const handleClaimAchievement = useCallback((achievementId: string) => {
    setAchievementProgress((prev) => {
      const result = claimReward(prev, achievementId);
      setState((vs) => ({
        ...vs,
        resources: { ...vs.resources, gems: vs.resources.gems + result.gemsEarned },
      }));
      return result.progress;
    });
  }, [setState]);

  // Magic items state and handlers
  const [inventory, setInventory] = useState<MagicItemInventory>(createInventory);

  const handleUseMagicItem = useCallback((itemId: string) => {
    // Simplified: for now just consume the item
    setInventory((prev) => {
      const count = prev.items[itemId] ?? 0;
      if (count <= 0) return prev;
      return { items: { ...prev.items, [itemId]: count - 1 } };
    });
  }, []);

  // Super troop state and handlers
  const [superTroopState, setSuperTroopState] = useState<SuperTroopState>(createSuperTroopState);

  const handleBoostSuperTroop = useCallback((superTroopName: string) => {
    const result = boostSuperTroop(superTroopState, superTroopName, state.townHallLevel, state.resources.darkElixir);
    if (!result) return;
    setSuperTroopState(result.state);
    setState((prev) => ({
      ...prev,
      resources: { ...prev.resources, darkElixir: prev.resources.darkElixir - result.cost },
    }));
  }, [superTroopState, state.townHallLevel, state.resources.darkElixir, setState]);

  const handleUnboostSuperTroop = useCallback((superTroopName: string) => {
    setSuperTroopState((prev) => unboostSuperTroop(prev, superTroopName));
  }, []);

  // Statistics
  const [stats] = useState<GameStatistics>(createStatistics);

  // Spell handlers
  const handleTrainSpell = useCallback((spellName: string) => {
    setState((prev) => trainSpell(prev, spellName) ?? prev);
  }, [setState]);

  const handleRemoveSpell = useCallback((spellName: string) => {
    setState((prev) => removeSpell(prev, spellName));
  }, [setState]);

  // Clan war state and handlers
  const [warState, setWarState] = useState<WarState | null>(null);

  const handleStartWar = useCallback((warSize: number) => {
    if (!clan) return;
    const playerTHLevels = Array.from({ length: warSize }, () => state.townHallLevel);
    setWarState(startWar(clan.name, playerTHLevels, warSize));
  }, [clan, state.townHallLevel]);

  const handleWarAttack = useCallback((defenderIndex: number) => {
    if (!warState || warState.phase !== 'battle') return;
    // Start battle phase if still in preparation
    let war = warState;
    if (war.phase === 'preparation') {
      war = startBattlePhase(war);
    }
    // Simulate a player attack (simplified: random 1-3 stars, 40-100% destruction)
    const stars = Math.min(3, Math.max(1, Math.floor(Math.random() * 3) + 1));
    const destruction = Math.min(100, Math.floor(40 + Math.random() * 60));
    war = recordPlayerAttack(war, 0, defenderIndex, stars, destruction);
    war = simulateNPCAttacks(war);
    setWarState(war);
  }, [warState]);

  const handleEndWar = useCallback(() => {
    if (!warState) return;
    const result = endWar(warState);
    setWarState(result.war);
  }, [warState]);

  // Count walls and traps for the shop panel
  const wallCount = state.walls?.length ?? 0;
  const trapCounts: Record<string, number> = {};
  for (const trap of state.traps ?? []) {
    trapCounts[trap.trapId] = (trapCounts[trap.trapId] ?? 0) + 1;
  }

  return (
    <div className="relative min-h-screen bg-slate-900 overflow-hidden">
      <HUD
        resources={state.resources}
        storageCaps={storageCaps}
        builders={builders}
        townHallLevel={state.townHallLevel}
        trophies={state.trophies}
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
      </div>

      {selectedBuilding && (
        <BuildingPanel
          building={selectedBuilding}
          onUpgrade={handleUpgrade}
          onMove={handleMoveBuilding}
          onRemove={handleRemove}
          onClose={handleClosePanel}
          canUpgrade={canUpgrade}
          upgradeCost={upgradeCost}
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
          availableTroops={getAvailableTroops(state)}
          housingUsed={getCurrentHousingUsed(state)}
          housingMax={getMaxHousingSpace(state)}
          resources={state.resources}
          onTrain={handleTrainTroop}
          onRemove={handleRemoveTroop}
          onClose={closePanel}
        />
      )}

      {activePanel === 'lab' && (
        <LabPanel
          labLevel={getLabLevel(state)}
          troops={getAllTroops()}
          troopLevels={Object.fromEntries(state.army.map((t) => [t.name, t.level]))}
          resources={state.resources}
          onResearch={handleResearch}
          onClose={closePanel}
        />
      )}

      {activePanel === 'clan' && (
        <ClanPanel
          clan={clan}
          townHallLevel={state.townHallLevel}
          onCreateClan={handleCreateClan}
          onClose={closePanel}
        />
      )}

      {activePanel === 'heroes' && (
        <HeroPanel
          heroes={state.heroes}
          townHallLevel={state.townHallLevel}
          onUpdateHero={handleUpdateHero}
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
          inventory={inventory}
          onUseItem={handleUseMagicItem}
          onClose={closePanel}
        />
      )}

      {activePanel === 'superTroops' && (
        <SuperTroopPanel
          superTroopState={superTroopState}
          townHallLevel={state.townHallLevel}
          darkElixir={state.resources.darkElixir}
          onBoost={handleBoostSuperTroop}
          onUnboost={handleUnboostSuperTroop}
          onClose={closePanel}
        />
      )}

      {activePanel === 'stats' && (
        <StatsPanel
          stats={stats}
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
          onStartWar={handleStartWar}
          onAttack={handleWarAttack}
          onEndWar={handleEndWar}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
