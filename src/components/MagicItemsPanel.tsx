import { useState, useMemo } from 'react';
import type { MagicItemType, MagicItemInventory } from '../engine/magic-items-manager.ts';
import { getAllMagicItems, getInventoryContents, getItemCount } from '../engine/magic-items-manager.ts';

type CategoryFilter = 'all' | MagicItemType;

interface MagicItemsPanelProps {
  inventory: MagicItemInventory;
  onUseItem: (itemId: string) => void;
  onClose: () => void;
}

const CATEGORY_TABS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'book', label: 'Books' },
  { key: 'potion', label: 'Potions' },
  { key: 'rune', label: 'Runes' },
  { key: 'wall_ring', label: 'Wall Rings' },
];

const TYPE_COLORS: Record<MagicItemType, { border: string; badge: string; text: string }> = {
  book: {
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/20 text-blue-300',
    text: 'text-blue-400',
  },
  potion: {
    border: 'border-green-500/40',
    badge: 'bg-green-500/20 text-green-300',
    text: 'text-green-400',
  },
  rune: {
    border: 'border-purple-500/40',
    badge: 'bg-purple-500/20 text-purple-300',
    text: 'text-purple-400',
  },
  wall_ring: {
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300',
    text: 'text-amber-400',
  },
};

export function MagicItemsPanel({ inventory, onUseItem, onClose }: MagicItemsPanelProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const allItems = useMemo(() => getAllMagicItems(), []);

  const displayItems = useMemo(() => {
    const filtered = filter === 'all' ? allItems : allItems.filter((item) => item.type === filter);

    return filtered.map((item) => ({
      item,
      count: getItemCount(inventory, item.id),
    }));
  }, [allItems, filter, inventory]);

  const inventoryContents = useMemo(() => getInventoryContents(inventory), [inventory]);
  const hasAnyItems = inventoryContents.length > 0;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="text-lg font-bold text-amber-400">Magic Items</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close magic items"
        >
          x
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex border-b border-slate-700">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              filter === tab.key
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!hasAnyItems && filter === 'all' ? (
          <p className="text-center text-slate-500 py-8 text-sm">
            No magic items yet. Win them from clan wars and events!
          </p>
        ) : (
          displayItems.map(({ item, count }) => {
            const colors = TYPE_COLORS[item.type];
            const canUse = count > 0;

            return (
              <div
                key={item.id}
                className={`px-3 py-2.5 rounded-lg border bg-slate-800/80 ${colors.border}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold text-sm ${colors.text}`}>
                    {item.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${colors.badge}`}>
                    {count} / {item.maxStack}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">{item.description}</p>
                <button
                  onClick={() => onUseItem(item.id)}
                  disabled={!canUse}
                  className={`w-full text-center text-xs font-semibold py-1.5 rounded transition-colors ${
                    canUse
                      ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                      : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Use
                </button>
              </div>
            );
          })
        )}
        {hasAnyItems && displayItems.length === 0 && (
          <p className="text-center text-slate-500 py-8 text-sm">
            No items in this category.
          </p>
        )}
      </div>
    </div>
  );
}
