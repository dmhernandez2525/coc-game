import type { Screen } from '../App.tsx';
import { VillageGrid } from './VillageGrid.tsx';
import { HUD } from './HUD.tsx';
import { BuildingPanel } from './BuildingPanel.tsx';
import { ShopPanel } from './ShopPanel.tsx';
import { useVillage } from '../hooks/useVillage.ts';

interface VillageScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function VillageScreen({ onNavigate }: VillageScreenProps) {
  const {
    state,
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

  return (
    <div className="relative min-h-screen bg-slate-900 overflow-hidden">
      {/* HUD */}
      <HUD
        resources={state.resources}
        builders={builders}
        townHallLevel={state.townHallLevel}
        trophies={state.trophies}
      />

      {/* Main grid area */}
      <div className="pt-14 pb-4 flex flex-col items-center">
        <VillageGrid
          state={state}
          onBuildingClick={handleBuildingClick}
          selectedBuilding={selectedId}
          placementMode={placementMode}
          onPlacementClick={handlePlacementClick}
        />

        {/* Action bar */}
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

        {/* Placement mode indicator */}
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

      {/* Building panel */}
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

      {/* Shop panel */}
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
