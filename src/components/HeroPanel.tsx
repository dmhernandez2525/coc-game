import { useState } from 'react';
import type { OwnedHero } from '../types/village.ts';
import type { HeroEquipmentData } from '../types/troops.ts';
import {
  getAvailableHeroes,
  getHeroStats,
  isHeroAvailableForBattle,
} from '../engine/hero-manager.ts';
import { equipItem, unequipItem } from '../engine/equipment-manager.ts';
import { getAvailablePets, assignPet, unassignPet } from '../engine/pet-manager.ts';
import { heroEquipment } from '../data/loaders/hero-loader.ts';
import { formatDuration } from '../utils/resource-format.ts';

// -- Types --

interface HeroPanelProps {
  heroes: OwnedHero[];
  townHallLevel: number;
  onUpdateHero: (heroName: string, updatedHero: OwnedHero) => void;
  onClose: () => void;
}

type DropdownState =
  | { heroName: string; type: 'equipment'; slotIndex: 0 | 1 }
  | { heroName: string; type: 'pet' }
  | null;

interface NamedEquipment {
  name: string;
  data: HeroEquipmentData;
}

// -- Helpers --

function getNamedEquipmentForHero(heroName: string): NamedEquipment[] {
  return Object.entries(heroEquipment)
    .filter(([, eq]) => eq.hero === heroName)
    .map(([name, data]) => ({ name, data }));
}

function getStatusLabel(hero: OwnedHero): { text: string; color: string } {
  if (hero.isUpgrading) {
    return {
      text: `Upgrading (${formatDuration(hero.upgradeTimeRemaining)})`,
      color: 'text-blue-400',
    };
  }
  if (hero.isRecovering) {
    return {
      text: `Recovering (${formatDuration(hero.recoveryTimeRemaining)})`,
      color: 'text-orange-400',
    };
  }
  return { text: 'Available', color: 'text-green-400' };
}

// -- Equipment Slot --

function EquipmentSlot({
  hero,
  slotIndex,
  equipmentList,
  isOpen,
  onToggle,
  onEquip,
  onUnequip,
}: {
  hero: OwnedHero;
  slotIndex: 0 | 1;
  equipmentList: NamedEquipment[];
  isOpen: boolean;
  onToggle: () => void;
  onEquip: (slotIndex: 0 | 1, equipmentName: string) => void;
  onUnequip: (slotIndex: 0 | 1) => void;
}) {
  const equippedName = hero.equippedItems[slotIndex];
  const otherSlot: 0 | 1 = slotIndex === 0 ? 1 : 0;

  return (
    <div className="relative">
      <div className="flex items-center justify-between bg-slate-700/50 rounded px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Slot {slotIndex + 1}:</span>
          {equippedName ? (
            <span className="text-xs text-amber-300 font-medium">{equippedName}</span>
          ) : (
            <span className="text-xs text-slate-500 italic">Empty Slot</span>
          )}
        </div>
        <div className="flex gap-1">
          {equippedName && (
            <button
              onClick={() => onUnequip(slotIndex)}
              className="px-2 py-0.5 rounded text-xs bg-red-700/60 hover:bg-red-600 text-red-200 transition-colors"
              aria-label={`Unequip ${equippedName} from slot ${slotIndex + 1}`}
            >
              Remove
            </button>
          )}
          <button
            onClick={onToggle}
            className="px-2 py-0.5 rounded text-xs bg-amber-600/60 hover:bg-amber-500 text-amber-100 transition-colors"
            aria-label={`Equip item to slot ${slotIndex + 1}`}
          >
            Equip
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-1 bg-slate-700 rounded border border-slate-600 max-h-32 overflow-y-auto">
          {equipmentList.length === 0 ? (
            <p className="text-xs text-slate-500 italic px-2 py-1">No equipment available.</p>
          ) : (
            equipmentList.map((eq) => {
              const alreadyInOther = hero.equippedItems[otherSlot] === eq.name;
              return (
                <button
                  key={eq.name}
                  onClick={() => onEquip(slotIndex, eq.name)}
                  disabled={alreadyInOther}
                  className="w-full text-left px-2 py-1 text-xs hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-white">{eq.name}</span>
                  <span className="ml-1 text-slate-500 capitalize">({eq.data.rarity})</span>
                  {alreadyInOther && (
                    <span className="ml-1 text-slate-500">(other slot)</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// -- Pet Section --

function PetSection({
  hero,
  allHeroes,
  townHallLevel,
  isOpen,
  onToggle,
  onAssign,
  onUnassign,
}: {
  hero: OwnedHero;
  allHeroes: OwnedHero[];
  townHallLevel: number;
  isOpen: boolean;
  onToggle: () => void;
  onAssign: (petName: string) => void;
  onUnassign: () => void;
}) {
  const availablePets = getAvailablePets(townHallLevel);

  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
        Pet
      </h4>
      <div className="relative">
        <div className="flex items-center justify-between bg-slate-700/50 rounded px-2 py-1.5">
          {hero.assignedPet ? (
            <span className="text-xs text-purple-300 font-medium">{hero.assignedPet}</span>
          ) : (
            <span className="text-xs text-slate-500 italic">No Pet</span>
          )}
          <div className="flex gap-1">
            {hero.assignedPet && (
              <button
                onClick={onUnassign}
                className="px-2 py-0.5 rounded text-xs bg-red-700/60 hover:bg-red-600 text-red-200 transition-colors"
                aria-label={`Unassign ${hero.assignedPet}`}
              >
                Remove
              </button>
            )}
            <button
              onClick={onToggle}
              className="px-2 py-0.5 rounded text-xs bg-purple-600/60 hover:bg-purple-500 text-purple-100 transition-colors"
              aria-label="Assign pet"
            >
              Assign
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-1 bg-slate-700 rounded border border-slate-600 max-h-32 overflow-y-auto">
            {availablePets.length === 0 ? (
              <p className="text-xs text-slate-500 italic px-2 py-1">No pets available.</p>
            ) : (
              availablePets.map((pet) => {
                const assignedElsewhere = allHeroes.some(
                  (h) => h.assignedPet === pet.name && h.name !== hero.name,
                );
                return (
                  <button
                    key={pet.name}
                    onClick={() => onAssign(pet.name)}
                    disabled={assignedElsewhere}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="text-white">{pet.name}</span>
                    {assignedElsewhere && (
                      <span className="ml-1 text-slate-500">(assigned)</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -- Hero Card --

function HeroCard({
  hero,
  townHallLevel,
  allHeroes,
  activeDropdown,
  onSetDropdown,
  onUpdateHero,
}: {
  hero: OwnedHero;
  townHallLevel: number;
  allHeroes: OwnedHero[];
  activeDropdown: DropdownState;
  onSetDropdown: (state: DropdownState) => void;
  onUpdateHero: (heroName: string, updatedHero: OwnedHero) => void;
}) {
  const stats = getHeroStats(hero.name, hero.level);
  const status = getStatusLabel(hero);
  const available = isHeroAvailableForBattle(hero);
  const equipmentList = getNamedEquipmentForHero(hero.name);

  const handleEquip = (slotIndex: 0 | 1, equipmentName: string) => {
    const updated = equipItem(hero, slotIndex, equipmentName);
    if (updated) {
      onUpdateHero(hero.name, updated);
    }
    onSetDropdown(null);
  };

  const handleUnequip = (slotIndex: 0 | 1) => {
    const updated = unequipItem(hero, slotIndex);
    onUpdateHero(hero.name, updated);
  };

  const handleAssignPet = (petName: string) => {
    const updated = assignPet(hero, petName, allHeroes);
    if (updated) {
      onUpdateHero(hero.name, updated);
    }
    onSetDropdown(null);
  };

  const handleUnassignPet = () => {
    const updated = unassignPet(hero);
    onUpdateHero(hero.name, updated);
  };

  const isEquipDropdownOpen = (slotIndex: 0 | 1) =>
    activeDropdown !== null &&
    activeDropdown.type === 'equipment' &&
    activeDropdown.heroName === hero.name &&
    activeDropdown.slotIndex === slotIndex;

  const isPetDropdownOpen =
    activeDropdown !== null &&
    activeDropdown.type === 'pet' &&
    activeDropdown.heroName === hero.name;

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-3">
      {/* Hero header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{hero.name}</h3>
          <span className="text-xs text-slate-400">Level {hero.level}</span>
        </div>
        <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
      </div>

      {/* HP bar */}
      {stats && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>HP</span>
            <span>
              {hero.currentHp} / {stats.hitpoints}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${available ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{
                width: `${Math.min((hero.currentHp / stats.hitpoints) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span>DPS: {stats.dps}</span>
            {stats.abilityLevel !== null && <span>Ability Lv {stats.abilityLevel}</span>}
          </div>
        </div>
      )}

      {/* Equipment slots */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
          Equipment
        </h4>
        <div className="space-y-1">
          {([0, 1] as const).map((slotIndex) => (
            <EquipmentSlot
              key={slotIndex}
              hero={hero}
              slotIndex={slotIndex}
              equipmentList={equipmentList}
              isOpen={isEquipDropdownOpen(slotIndex)}
              onToggle={() =>
                onSetDropdown(
                  isEquipDropdownOpen(slotIndex)
                    ? null
                    : { heroName: hero.name, type: 'equipment', slotIndex },
                )
              }
              onEquip={handleEquip}
              onUnequip={handleUnequip}
            />
          ))}
        </div>
      </div>

      {/* Pet assignment */}
      <PetSection
        hero={hero}
        allHeroes={allHeroes}
        townHallLevel={townHallLevel}
        isOpen={isPetDropdownOpen}
        onToggle={() =>
          onSetDropdown(
            isPetDropdownOpen ? null : { heroName: hero.name, type: 'pet' },
          )
        }
        onAssign={handleAssignPet}
        onUnassign={handleUnassignPet}
      />
    </div>
  );
}

// -- Main Panel --

export function HeroPanel({
  heroes,
  townHallLevel,
  onUpdateHero,
  onClose,
}: HeroPanelProps) {
  const [activeDropdown, setActiveDropdown] = useState<DropdownState>(null);
  const availableHeroDefinitions = getAvailableHeroes(townHallLevel);
  const hasHeroes = heroes.length > 0 || availableHeroDefinitions.length > 0;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-slate-900/95 border-l-2 border-amber-500/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-400">Heroes</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none px-2"
          aria-label="Close hero panel"
        >
          x
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!hasHeroes ? (
          <p className="text-sm text-slate-500 italic text-center py-8">
            Heroes unlock at higher Town Hall levels.
          </p>
        ) : heroes.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-8">
            No heroes owned yet. Build a hero altar to unlock heroes.
          </p>
        ) : (
          heroes.map((hero) => (
            <HeroCard
              key={hero.name}
              hero={hero}
              townHallLevel={townHallLevel}
              allHeroes={heroes}
              activeDropdown={activeDropdown}
              onSetDropdown={setActiveDropdown}
              onUpdateHero={onUpdateHero}
            />
          ))
        )}
      </div>
    </div>
  );
}
