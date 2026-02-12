import { useState, useMemo } from 'react';
import type { PlacedBuilding, ResourceAmounts } from '../types/village.ts';
import {
  getTownHall,
  getDefense,
  getAllDefenseNames,
  getCollectors,
  getStorages,
  getArmyBuilding,
  getAllArmyBuildingNames,
  traps as trapDataList,
  wallData,
} from '../data/loaders/index.ts';

type Tab = 'defenses' | 'resources' | 'army' | 'traps' | 'walls';

interface ShopItem {
  id: string;
  name: string;
  category: PlacedBuilding['buildingType'];
  cost: number;
  costResource: string;
  maxCount: number;
  placedCount: number;
  unlocked: boolean;
}

interface ShopPanelProps {
  townHallLevel: number;
  placedBuildings: PlacedBuilding[];
  resources: ResourceAmounts;
  wallCount?: number;
  trapCounts?: Record<string, number>;
  onSelectBuilding: (buildingId: string, buildingType: PlacedBuilding['buildingType']) => void;
  onSelectTrap?: (trapId: string) => void;
  onSelectWall?: () => void;
  onClose: () => void;
}

function countPlaced(buildings: PlacedBuilding[], buildingId: string): number {
  return buildings.filter((b) => b.buildingId === buildingId).length;
}

function resourceKey(resource: string): keyof ResourceAmounts {
  const map: Record<string, keyof ResourceAmounts> = {
    'Gold': 'gold',
    'Elixir': 'elixir',
    'Dark Elixir': 'darkElixir',
  };
  return map[resource] ?? 'gold';
}

export function ShopPanel({
  townHallLevel,
  placedBuildings,
  resources,
  wallCount = 0,
  trapCounts = {},
  onSelectBuilding,
  onSelectTrap,
  onSelectWall,
  onClose,
}: ShopPanelProps) {
  const [tab, setTab] = useState<Tab>('defenses');
  const th = getTownHall(townHallLevel);

  const items = useMemo(() => {
    if (!th) return [];

    const result: ShopItem[] = [];

    if (tab === 'defenses') {
      for (const name of getAllDefenseNames()) {
        const def = getDefense(name);
        if (!def) continue;
        const maxCount = th.buildingCounts[name] ?? 0;
        if (maxCount === 0) continue;
        const lvl1 = def.levels[0];
        if (!lvl1) continue;
        result.push({
          id: name,
          name,
          category: 'defense',
          cost: lvl1.upgradeCost,
          costResource: lvl1.upgradeResource,
          maxCount,
          placedCount: countPlaced(placedBuildings, name),
          unlocked: def.thUnlock <= townHallLevel,
        });
      }
    }

    if (tab === 'resources') {
      const all = [...getCollectors(), ...getStorages()];
      for (const bld of all) {
        const maxCount = th.buildingCounts[bld.name] ?? 0;
        if (maxCount === 0) continue;
        const lvl1 = bld.levels[0];
        if (!lvl1) continue;
        result.push({
          id: bld.name,
          name: bld.name,
          category: bld.category,
          cost: lvl1.upgradeCost,
          costResource: lvl1.upgradeResource,
          maxCount,
          placedCount: countPlaced(placedBuildings, bld.name),
          unlocked: bld.thUnlock <= townHallLevel,
        });
      }
    }

    if (tab === 'army') {
      for (const name of getAllArmyBuildingNames()) {
        const bld = getArmyBuilding(name);
        if (!bld) continue;
        const maxCount = th.buildingCounts[name] ?? 0;
        if (maxCount === 0) continue;
        const lvl1 = bld.levels[0];
        if (!lvl1) continue;
        result.push({
          id: name,
          name,
          category: 'army',
          cost: lvl1.upgradeCost,
          costResource: lvl1.upgradeResource,
          maxCount,
          placedCount: countPlaced(placedBuildings, name),
          unlocked: bld.thUnlock <= townHallLevel,
        });
      }
    }

    if (tab === 'traps') {
      for (const trap of trapDataList) {
        const maxCount = trap.maxCountByTH[String(townHallLevel)] ?? 0;
        if (maxCount === 0) continue;
        const lvl1 = trap.levels[0];
        if (!lvl1) continue;
        result.push({
          id: trap.name,
          name: trap.name,
          category: 'defense',
          cost: lvl1.upgradeCost,
          costResource: lvl1.upgradeResource,
          maxCount,
          placedCount: trapCounts[trap.name] ?? 0,
          unlocked: trap.thUnlock <= townHallLevel,
        });
      }
    }

    if (tab === 'walls') {
      if (wallData) {
        const maxWalls = th.maxWalls ?? 0;
        const wallLvl1 = wallData.levels[0];
        if (maxWalls > 0 && wallLvl1) {
          result.push({
            id: 'Wall',
            name: 'Wall',
            category: 'defense',
            cost: wallLvl1.upgradeCost,
            costResource: wallLvl1.upgradeResource,
            maxCount: maxWalls,
            placedCount: wallCount,
            unlocked: wallData.thUnlock <= townHallLevel,
          });
        }
      }
    }

    return result;
  }, [tab, th, townHallLevel, placedBuildings, wallCount, trapCounts]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'defenses', label: 'Defenses' },
    { key: 'resources', label: 'Resources' },
    { key: 'army', label: 'Army' },
    { key: 'traps', label: 'Traps' },
    { key: 'walls', label: 'Walls' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="text-lg font-bold text-amber-400">Shop</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close shop"
        >
          x
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map((item) => {
          const remaining = item.maxCount - item.placedCount;
          const affordable = resources[resourceKey(item.costResource)] >= item.cost;
          const canBuy = remaining > 0 && affordable && item.unlocked;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (!canBuy) return;
                if (tab === 'traps' && onSelectTrap) {
                  onSelectTrap(item.id);
                } else if (tab === 'walls' && onSelectWall) {
                  onSelectWall();
                } else {
                  onSelectBuilding(item.id, item.category);
                }
              }}
              disabled={!canBuy}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                canBuy
                  ? 'bg-slate-800 hover:bg-slate-700 cursor-pointer'
                  : 'bg-slate-800/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">{item.name}</span>
                <span className="text-xs text-slate-400">
                  {item.placedCount}/{item.maxCount}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                <span className={item.costResource === 'Gold' ? 'text-yellow-400' : 'text-purple-400'}>
                  {item.cost.toLocaleString()} {item.costResource}
                </span>
                {remaining <= 0 && (
                  <span className="ml-2 text-red-400">Max reached</span>
                )}
                {!item.unlocked && (
                  <span className="ml-2 text-red-400">Locked</span>
                )}
              </div>
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="text-center text-slate-500 py-8 text-sm">
            No buildings available in this category.
          </p>
        )}
      </div>
    </div>
  );
}
