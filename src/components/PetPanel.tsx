import type { OwnedHero, OwnedLevelEntry } from '../types/village.ts';
import type { PetData } from '../types/troops.ts';
import {
  getPetStats,
  getPetUpgradeCost,
  getOwnedPetLevel,
  isPetUnlocked,
  isPetMaxLevel,
} from '../engine/pet-manager.ts';
import { pets } from '../data/loaders/hero-loader.ts';
import { formatResource } from '../utils/resource-format.ts';

// -- Types --

interface PetPanelProps {
  hero: OwnedHero;
  allHeroes: OwnedHero[];
  ownedPets: OwnedLevelEntry[];
  townHallLevel: number;
  petHouseLevel: number;
  darkElixir: number;
  onAssign: (petName: string) => void;
  onUnassign: () => void;
  onUpgradePet: (petName: string) => void;
  onClose: () => void;
}

// -- Helpers --

/** Why a pet cannot be assigned right now, or null when it can. */
function getAssignBlockReason(
  pet: PetData,
  hero: OwnedHero,
  allHeroes: OwnedHero[],
  townHallLevel: number,
  petHouseLevel: number,
): string | null {
  if (pet.thUnlock > townHallLevel) return `Requires Town Hall ${pet.thUnlock}`;
  if (pet.petHouseLevelRequired > petHouseLevel) {
    return `Requires Pet House level ${pet.petHouseLevelRequired}`;
  }
  const holder = allHeroes.find((h) => h.assignedPet === pet.name && h.name !== hero.name);
  if (holder) return `Assigned to ${holder.name}`;
  return null;
}

// -- Pet Card --

function PetCard({
  pet,
  hero,
  allHeroes,
  level,
  townHallLevel,
  petHouseLevel,
  darkElixir,
  onAssign,
  onUnassign,
  onUpgradePet,
}: {
  pet: PetData;
  hero: OwnedHero;
  allHeroes: OwnedHero[];
  level: number;
  townHallLevel: number;
  petHouseLevel: number;
  darkElixir: number;
  onAssign: (petName: string) => void;
  onUnassign: () => void;
  onUpgradePet: (petName: string) => void;
}) {
  const stats = getPetStats(pet.name, level);
  const unlocked = isPetUnlocked(pet.name, townHallLevel, petHouseLevel);
  const assignedToThisHero = hero.assignedPet === pet.name;
  const blockReason = getAssignBlockReason(pet, hero, allHeroes, townHallLevel, petHouseLevel);
  const upgradeCost = getPetUpgradeCost(pet.name, level);
  const canUpgrade = unlocked && upgradeCost !== null && darkElixir >= upgradeCost.cost;

  return (
    <div className={`bg-slate-800 rounded-lg p-3 space-y-2 ${unlocked ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-purple-300">{pet.name}</span>
        <span className="text-xs text-slate-400 tabular-nums">Lv {level}</span>
      </div>

      <p className="text-xs text-slate-500">{pet.ability}</p>

      {stats && (
        <div className="flex gap-3 text-xs text-slate-400 tabular-nums">
          <span>HP: {stats.hp}</span>
          {stats.dps !== undefined && <span>DPS: {stats.dps}</span>}
          {stats.healingPerSecond !== undefined && <span>Heal/s: {stats.healingPerSecond}</span>}
        </div>
      )}

      {/* Assign / unassign actions */}
      <div className="flex items-center gap-1">
        {assignedToThisHero ? (
          <>
            <span className="text-xs text-green-400 mr-1">Assigned to {hero.name}</span>
            <button
              onClick={onUnassign}
              className="px-2 py-0.5 rounded text-xs bg-red-700/60 hover:bg-red-600 text-red-200 transition-colors"
              aria-label={`Unassign ${pet.name}`}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onAssign(pet.name)}
              disabled={blockReason !== null}
              className="px-2 py-0.5 rounded text-xs bg-purple-600/60 hover:bg-purple-500 text-purple-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={`Assign ${pet.name}`}
            >
              Assign
            </button>
            {blockReason && <span className="text-xs text-slate-500">{blockReason}</span>}
          </>
        )}
      </div>

      {/* Upgrade action */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {isPetMaxLevel(pet.name, level)
            ? 'Max level reached'
            : upgradeCost
              ? `Upgrade: ${formatResource(upgradeCost.cost)} Dark Elixir`
              : ''}
        </span>
        {upgradeCost && (
          <button
            onClick={() => onUpgradePet(pet.name)}
            disabled={!canUpgrade}
            title={canUpgrade ? undefined : 'Not enough Dark Elixir'}
            className="px-2 py-0.5 rounded text-xs bg-cyan-700/60 hover:bg-cyan-600 text-cyan-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Upgrade ${pet.name}`}
          >
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
}

// -- Main Panel --

export function PetPanel({
  hero,
  allHeroes,
  ownedPets,
  townHallLevel,
  petHouseLevel,
  darkElixir,
  onAssign,
  onUnassign,
  onUpgradePet,
  onClose,
}: PetPanelProps) {
  const petHouseBuilt = petHouseLevel > 0;
  const allPets = Object.values(pets);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-slate-900/95 border-l-2 border-purple-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-purple-400">Pets</h2>
          <span className="text-xs text-slate-400">{hero.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close pet panel"
        >
          x
        </button>
      </div>

      {/* Pet House status */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-3 text-xs tabular-nums">
        <span className="text-slate-400">Dark Elixir: {formatResource(darkElixir)}</span>
        <span className="ml-auto text-slate-500">
          {petHouseBuilt ? `Pet House Lv ${petHouseLevel}` : 'No Pet House'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!petHouseBuilt && (
          <p className="text-xs text-orange-400 bg-orange-950/40 rounded px-3 py-2">
            Build the Pet House to unlock and assign Hero Pets.
          </p>
        )}

        {allPets.map((pet) => (
          <PetCard
            key={pet.name}
            pet={pet}
            hero={hero}
            allHeroes={allHeroes}
            level={getOwnedPetLevel(ownedPets, pet.name)}
            townHallLevel={townHallLevel}
            petHouseLevel={petHouseLevel}
            darkElixir={darkElixir}
            onAssign={onAssign}
            onUnassign={onUnassign}
            onUpgradePet={onUpgradePet}
          />
        ))}
      </div>
    </div>
  );
}
