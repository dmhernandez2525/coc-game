import type React from 'react';
import { useState, useCallback, useMemo } from 'react';
import type { VillageState, PlacedBuilding } from '../types/village.ts';
import type { PlacementMode } from '../components/VillageGrid.tsx';
import { createStarterVillage, startUpgrade } from '../engine/village-manager.ts';
import { getUpgradeCost, deductResources } from '../engine/village-helpers.ts';
import {
  getDefense,
  getResourceBuilding,
  getArmyBuilding,
} from '../data/loaders/index.ts';
import { canPlaceBuilding, buildOccupiedSet } from '../utils/grid-utils.ts';

/** Default building sizes. Fallback to 3x3 for unknown buildings. */
const BUILDING_SIZES: Record<string, { w: number; h: number }> = {
  'Town Hall': { w: 4, h: 4 },
  'Cannon': { w: 3, h: 3 },
  'Archer Tower': { w: 3, h: 3 },
  'Mortar': { w: 3, h: 3 },
  'Gold Mine': { w: 3, h: 3 },
  'Elixir Collector': { w: 3, h: 3 },
  'Gold Storage': { w: 3, h: 3 },
  'Elixir Storage': { w: 3, h: 3 },
  'Army Camp': { w: 5, h: 5 },
  'Barracks': { w: 3, h: 3 },
};

function getBuildingSize(id: string): { w: number; h: number } {
  return BUILDING_SIZES[id] ?? { w: 3, h: 3 };
}

function lookupUpgradeCost(building: PlacedBuilding) {
  const nextLevel = building.level + 1;

  const defense = getDefense(building.buildingId);
  if (defense) {
    const lvl = defense.levels.find((l) => l.level === nextLevel);
    if (!lvl) return null;
    return { amount: lvl.upgradeCost, resource: lvl.upgradeResource, time: lvl.upgradeTime };
  }

  const resBld = getResourceBuilding(building.buildingId);
  if (resBld) {
    const lvl = resBld.levels.find((l) => l.level === nextLevel);
    if (!lvl) return null;
    return { amount: lvl.upgradeCost, resource: lvl.upgradeResource, time: lvl.upgradeTime };
  }

  const armyBld = getArmyBuilding(building.buildingId);
  if (armyBld) {
    const lvl = armyBld.levels.find((l) => l.level === nextLevel);
    if (!lvl) return null;
    return { amount: lvl.upgradeCost, resource: lvl.upgradeResource, time: lvl.upgradeTime };
  }

  return null;
}

let instanceCounter = 100;

export function useVillage(
  externalState?: VillageState,
  externalSetState?: React.Dispatch<React.SetStateAction<VillageState>>,
) {
  const [internalState, internalSetState] = useState<VillageState>(createStarterVillage);
  const state = externalState ?? internalState;
  const setState = externalSetState ?? internalSetState;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode | null>(null);
  const [placementType, setPlacementType] = useState<PlacedBuilding['buildingType']>('other');
  const [placementFree, setPlacementFree] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const selectedBuilding = useMemo(() => {
    if (!selectedId) return null;
    return state.buildings.find((b) => b.instanceId === selectedId) ?? null;
  }, [selectedId, state.buildings]);

  const upgradeCost = useMemo(() => {
    if (!selectedBuilding) return null;
    return lookupUpgradeCost(selectedBuilding);
  }, [selectedBuilding]);

  const canUpgrade = useMemo(() => {
    if (!selectedBuilding || !upgradeCost) return false;
    if (selectedBuilding.isUpgrading) return false;
    const idle = state.builders.filter((b) => b.isUnlocked && !b.assignedTo);
    if (idle.length === 0) return false;
    const resKey = upgradeCost.resource === 'Gold' ? 'gold' : 'elixir';
    return state.resources[resKey] >= upgradeCost.amount;
  }, [selectedBuilding, upgradeCost, state.builders, state.resources]);

  const builders = useMemo(() => {
    const unlocked = state.builders.filter((b) => b.isUnlocked);
    const idle = unlocked.filter((b) => !b.assignedTo);
    return { idle: idle.length, total: unlocked.length };
  }, [state.builders]);

  const handleBuildingClick = useCallback((instanceId: string) => {
    setSelectedId(instanceId);
    setShopOpen(false);
  }, []);

  const handleUpgrade = useCallback(() => {
    if (!selectedBuilding || !upgradeCost || !canUpgrade) return;
    // Engine startUpgrade deducts resources and assigns an idle builder
    setState((prev) => startUpgrade(prev, selectedBuilding.instanceId) ?? prev);
  }, [selectedBuilding, upgradeCost, canUpgrade]);

  const handleRemove = useCallback(() => {
    if (!selectedBuilding || selectedBuilding.buildingId === 'Town Hall') return;
    setState((prev) => ({
      ...prev,
      buildings: prev.buildings.filter((b) => b.instanceId !== selectedBuilding.instanceId),
    }));
    setSelectedId(null);
  }, [selectedBuilding]);

  const handleClosePanel = useCallback(() => {
    setSelectedId(null);
  }, []);

  const startPlacement = useCallback(
    (buildingId: string, buildingType: PlacedBuilding['buildingType'], options?: { free?: boolean }) => {
      const size = getBuildingSize(buildingId);
      setPlacementMode({ buildingId, width: size.w, height: size.h });
      setPlacementType(buildingType);
      setPlacementFree(options?.free ?? false);
      setSelectedId(null);
      setShopOpen(false);
    },
    [],
  );

  const handlePlacementClick = useCallback(
    (gridX: number, gridY: number) => {
      if (!placementMode) return;
      // Walls, traps, and obstacles occupy tiles too (1x1 each), matching the
      // engine's collision rules; without them placement stacks onto them.
      const occupied = buildOccupiedSet([
        ...state.buildings.map((b) => {
          const s = getBuildingSize(b.buildingId);
          return { gridX: b.gridX, gridY: b.gridY, width: s.w, height: s.h };
        }),
        ...state.walls.map((w) => ({ gridX: w.gridX, gridY: w.gridY, width: 1, height: 1 })),
        ...state.traps.map((t) => ({ gridX: t.gridX, gridY: t.gridY, width: 1, height: 1 })),
        ...state.obstacles.map((o) => ({ gridX: o.gridX, gridY: o.gridY, width: 1, height: 1 })),
      ]);
      if (!canPlaceBuilding(gridX, gridY, placementMode.width, placementMode.height, occupied)) {
        return;
      }

      instanceCounter += 1;
      const newBuilding: PlacedBuilding = {
        instanceId: `bld_${instanceCounter}`,
        buildingId: placementMode.buildingId,
        buildingType: placementType,
        level: 1,
        gridX,
        gridY,
        isUpgrading: false,
        upgradeTimeRemaining: 0,
        assignedBuilder: null,
      };

      setState((prev) => {
        // New buildings cost their level 1 price; moves (placementFree) are free
        let newResources = prev.resources;
        if (!placementFree) {
          const costInfo = getUpgradeCost(placementMode.buildingId, 1);
          if (!costInfo) return prev;
          const deducted = deductResources(prev.resources, costInfo.cost, costInfo.resource);
          if (!deducted) return prev;
          newResources = deducted;
        }
        return {
          ...prev,
          resources: newResources,
          buildings: [...prev.buildings, newBuilding],
        };
      });
      setPlacementMode(null);
    },
    [placementMode, placementType, placementFree, state.buildings],
  );

  const cancelPlacement = useCallback(() => {
    setPlacementMode(null);
  }, []);

  return {
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
  };
}
