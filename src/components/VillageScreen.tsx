import { useState, useCallback } from 'react';
import type { Screen } from '../App.tsx';
import { VillageGrid } from './VillageGrid.tsx';
import { HUD } from './HUD.tsx';
import { BuildingPanel } from './BuildingPanel.tsx';
import { ShopPanel } from './ShopPanel.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import { SaveLoadPanel } from './SaveLoadPanel.tsx';
import { GemShopPanel } from './GemShopPanel.tsx';
import { useVillage } from '../hooks/useVillage.ts';
import { useResources } from '../hooks/useResources.ts';
import { useAutoSave } from '../hooks/useAutoSave.ts';
import { createSaveManager } from '../engine/save-manager.ts';
import { createStarterVillage } from '../engine/village-manager.ts';

type ActivePanel = 'none' | 'shop' | 'settings' | 'saveLoad' | 'gemShop';

interface VillageScreenProps {
  onNavigate: (screen: Screen) => void;
}

const saveManager = createSaveManager();

export function VillageScreen({ onNavigate }: VillageScreenProps) {
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
  } = useVillage();

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
          onMove={() => {}}
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
    </div>
  );
}
