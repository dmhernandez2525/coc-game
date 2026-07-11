import type { TrainedTroop, ResourceAmounts } from '../types/village.ts';
import type { TroopData, SiegeMachineData } from '../types/troops.ts';
import { getTrainingCost } from '../engine/army-manager.ts';
import { getSiegeTrainingCost } from '../engine/siege-manager.ts';
import { formatResource } from '../utils/resource-format.ts';

export interface LockedTroopInfo {
  name: string;
  housingSpace: number;
  unlockHint: string;
}

interface ArmyPanelProps {
  army: TrainedTroop[];
  availableTroops: TroopData[];
  lockedTroops?: LockedTroopInfo[];
  housingUsed: number;
  housingMax: number;
  resources: ResourceAmounts;
  siegeMachines?: TrainedTroop[];
  availableSieges?: SiegeMachineData[];
  siegeCapacityUsed?: number;
  siegeCapacityMax?: number;
  siegeUnlockHint?: string | null;
  onTrain: (troopName: string) => void;
  onRemove: (troopName: string) => void;
  onTrainSiege?: (siegeName: string) => void;
  onRemoveSiege?: (siegeName: string) => void;
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

interface SiegeSectionProps {
  siegeMachines: TrainedTroop[];
  availableSieges: SiegeMachineData[];
  capacityUsed: number;
  capacityMax: number;
  unlockHint: string | null;
  resources: ResourceAmounts;
  onTrainSiege: (siegeName: string) => void;
  onRemoveSiege: (siegeName: string) => void;
}

function SiegeSection({
  siegeMachines,
  availableSieges,
  capacityUsed,
  capacityMax,
  unlockHint,
  resources,
  onTrainSiege,
  onRemoveSiege,
}: SiegeSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Siege Machines
        <span className="ml-2 text-xs font-normal text-slate-500">
          {capacityUsed} / {capacityMax}
        </span>
      </h3>
      {unlockHint && (
        <p className="text-sm text-slate-500 italic">{unlockHint}</p>
      )}
      {!unlockHint && siegeMachines.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {siegeMachines.map((siege) => (
            <div
              key={siege.name}
              className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
            >
              <div>
                <span className="text-sm text-white">{siege.name}</span>
                <span className="ml-2 text-xs text-amber-300">x{siege.count}</span>
              </div>
              <button
                onClick={() => onRemoveSiege(siege.name)}
                className="w-6 h-6 flex items-center justify-center rounded bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                aria-label={`Remove ${siege.name}`}
              >
                -
              </button>
            </div>
          ))}
        </div>
      )}
      {!unlockHint && (
        <div className="space-y-1">
          {availableSieges.map((siege) => {
            const cost = getSiegeTrainingCost(siege.name);
            if (!cost) return null;
            const affordable = canAfford(cost, resources);
            const hasSpace = capacityUsed < capacityMax;
            const disabled = !affordable || !hasSpace;

            return (
              <div
                key={siege.name}
                className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white">{siege.name}</span>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>{siege.isFlying ? 'Air' : 'Ground'}</span>
                    <span className={affordable ? 'text-amber-300' : 'text-red-400'}>
                      {formatResource(cost.amount)} {cost.resource}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onTrainSiege(siege.name)}
                  disabled={disabled}
                  className="w-7 h-7 flex items-center justify-center rounded bg-amber-600 hover:bg-amber-500 text-white text-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={`Train ${siege.name}`}
                >
                  +
                </button>
              </div>
            );
          })}
          {availableSieges.length === 0 && (
            <p className="text-sm text-slate-500 italic">
              Upgrade the Workshop to unlock siege machines.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ArmyPanel({
  army,
  availableTroops,
  lockedTroops = [],
  housingUsed,
  housingMax,
  resources,
  siegeMachines = [],
  availableSieges = [],
  siegeCapacityUsed = 0,
  siegeCapacityMax = 0,
  siegeUnlockHint = null,
  onTrain,
  onRemove,
  onTrainSiege,
  onRemoveSiege,
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

          {/* Siege Machines (TH12+ / Workshop gated) */}
          {onTrainSiege && onRemoveSiege && (
            <SiegeSection
              siegeMachines={siegeMachines}
              availableSieges={availableSieges}
              capacityUsed={siegeCapacityUsed}
              capacityMax={siegeCapacityMax}
              unlockHint={siegeUnlockHint}
              resources={resources}
              onTrainSiege={onTrainSiege}
              onRemoveSiege={onRemoveSiege}
            />
          )}

          {/* Locked Troops (TH / barracks gated) */}
          {lockedTroops.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Locked Troops
              </h3>
              <div className="space-y-1">
                {lockedTroops.map((troop) => (
                  <div
                    key={troop.name}
                    title={troop.unlockHint}
                    className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2 opacity-60 cursor-not-allowed"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-400">{troop.name}</span>
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span>Space: {troop.housingSpace}</span>
                        <span className="text-red-400">{troop.unlockHint}</span>
                      </div>
                    </div>
                    <span
                      className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 text-slate-500 text-sm"
                      aria-label={`${troop.name} locked`}
                    >
                      &#128274;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
