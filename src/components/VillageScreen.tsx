import type { Screen } from '../App.tsx';
import { VillageGrid } from './VillageGrid.tsx';
import { HUD } from './HUD.tsx';
import { BuildingPanel } from './BuildingPanel.tsx';
import { ShopPanel } from './ShopPanel.tsx';
import { useVillage } from '../hooks/useVillage.ts';
import { useResources } from '../hooks/useResources.ts';

interface VillageScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function VillageScreen({ onNavigate }: VillageScreenProps) {
  const {
    state,
    setState,
    selectedId,
    selectedBuilding,
    placementMode,
    shopOpen,
    upgradeCost,
    canUpgrade,
    builders,
    setShopOpen,
    handleBuildingClick,
    handleUpgrade,
    handleRemove,
    handleClosePanel,
    startPlacement,
    handlePlacementClick,
    cancelPlacement,
  } = useVillage();

  const { collect, collectAll, storageCaps } = useResources(state, setState);

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

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setShopOpen(true)}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Shop
          </button>
          <button
            onClick={() => onNavigate('battle')}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold text-sm transition-colors"
          >
            Attack
          </button>
          <button
            onClick={() => onNavigate('menu')}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold text-sm transition-colors"
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

      {shopOpen && (
        <ShopPanel
          townHallLevel={state.townHallLevel}
          placedBuildings={state.buildings}
          resources={state.resources}
          onSelectBuilding={startPlacement}
          onClose={() => setShopOpen(false)}
        />
      )}
    </div>
  );
}
