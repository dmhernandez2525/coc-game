import { useState } from 'react';

interface GemShopPanelProps {
  gems: number;
  onBuyResources: (resourceType: 'gold' | 'elixir' | 'darkElixir', amount: number, gemCost: number) => void;
  onClose: () => void;
}

interface BuyOption {
  resourceType: 'gold' | 'elixir' | 'darkElixir';
  label: string;
  amount: number;
  gemCost: number;
  colorClass: string;
}

const BUY_OPTIONS: readonly BuyOption[] = [
  { resourceType: 'gold', label: 'Buy 10,000 Gold', amount: 10_000, gemCost: 10, colorClass: 'text-yellow-400' },
  { resourceType: 'elixir', label: 'Buy 10,000 Elixir', amount: 10_000, gemCost: 10, colorClass: 'text-purple-400' },
  { resourceType: 'darkElixir', label: 'Buy 1,000 Dark Elixir', amount: 1_000, gemCost: 100, colorClass: 'text-indigo-400' },
] as const;

export function GemShopPanel({ gems, onBuyResources, onClose }: GemShopPanelProps) {
  const [purchasedType, setPurchasedType] = useState<string | null>(null);

  function handleBuy(option: BuyOption) {
    onBuyResources(option.resourceType, option.amount, option.gemCost);
    setPurchasedType(option.resourceType);
    setTimeout(() => setPurchasedType(null), 800);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/60 rounded-lg shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-400">Gem Shop</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close gem shop"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          {/* Gem balance */}
          <div className="text-center py-2 bg-slate-800 rounded-lg">
            <span className="text-sm text-slate-400">Your Gems:</span>
            <span className="ml-2 text-lg font-bold text-green-400">{gems.toLocaleString()}</span>
          </div>

          {/* Buy options */}
          <div className="space-y-2">
            {BUY_OPTIONS.map((option) => {
              const canAfford = gems >= option.gemCost;
              const justPurchased = purchasedType === option.resourceType;

              return (
                <button
                  key={option.resourceType}
                  onClick={() => canAfford && handleBuy(option)}
                  disabled={!canAfford}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    canAfford
                      ? 'bg-slate-800 hover:bg-slate-700 cursor-pointer'
                      : 'bg-slate-800/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-sm ${option.colorClass}`}>
                      {option.label}
                    </span>
                    <span className="text-xs text-green-400 font-semibold">
                      {option.gemCost} gems
                    </span>
                  </div>
                  {justPurchased && (
                    <p className="text-xs text-green-400 mt-1">Purchased!</p>
                  )}
                  {!canAfford && (
                    <p className="text-xs text-red-400 mt-1">Not enough gems</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
