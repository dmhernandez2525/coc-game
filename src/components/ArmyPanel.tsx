import type { TrainedTroop, ResourceAmounts } from '../types/village.ts';
import type { TroopData } from '../types/troops.ts';
import { getTrainingCost } from '../engine/army-manager.ts';
import { formatResource } from '../utils/resource-format.ts';

interface ArmyPanelProps {
  army: TrainedTroop[];
  availableTroops: TroopData[];
  housingUsed: number;
  housingMax: number;
  resources: ResourceAmounts;
  onTrain: (troopName: string) => void;
  onRemove: (troopName: string) => void;
  onClose: () => void;
}

const RES_MAP: Record<string, keyof ResourceAmounts> = {
  Gold: 'gold', Elixir: 'elixir', 'Dark Elixir': 'darkElixir',
};

function canAfford(cost: { amount: number; resource: string }, resources: ResourceAmounts): boolean {
  const key = RES_MAP[cost.resource];
  if (!key) return false;
  return resources[key] >= cost.amount;
}

export function ArmyPanel({
  army,
  availableTroops,
  housingUsed,
  housingMax,
  resources,
  onTrain,
  onRemove,
  onClose,
}: ArmyPanelProps) {
  const housingPercent = housingMax > 0 ? Math.min((housingUsed / housingMax) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-amber-400">Army</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
              aria-label="Close panel"
            >
              x
            </button>
          </div>
          {/* Housing bar */}
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span>{housingUsed} / {housingMax}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${housingPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Current Army */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Current Army
            </h3>
            {army.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No troops trained yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {army.map((troop) => (
                  <div
                    key={troop.name}
                    className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
                  >
                    <div>
                      <span className="text-sm text-white">{troop.name}</span>
                      <span className="ml-2 text-xs text-amber-300">x{troop.count}</span>
                    </div>
                    <button
                      onClick={() => onRemove(troop.name)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                      aria-label={`Remove ${troop.name}`}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Troops */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Available Troops
            </h3>
            <div className="space-y-1">
              {availableTroops.map((troop) => {
                const cost = getTrainingCost(troop.name);
                if (!cost) return null;
                const affordable = canAfford(cost, resources);
                const hasSpace = housingUsed + troop.housingSpace <= housingMax;
                const disabled = !affordable || !hasSpace;

                return (
                  <div
                    key={troop.name}
                    className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white">{troop.name}</span>
                      <div className="flex gap-3 text-xs text-slate-400">
                        <span>Space: {troop.housingSpace}</span>
                        <span className={affordable ? 'text-amber-300' : 'text-red-400'}>
                          {formatResource(cost.amount)} {cost.resource}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onTrain(troop.name)}
                      disabled={disabled}
                      className="w-7 h-7 flex items-center justify-center rounded bg-amber-600 hover:bg-amber-500 text-white text-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Train ${troop.name}`}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
