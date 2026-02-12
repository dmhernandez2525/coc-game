import type {
  HeroData,
  HeroesData,
  HeroEquipmentData,
  HeroEquipmentMap,
  PetData,
  PetsData,
} from '../../types';
import heroesJson from '../heroes.json';
import heroEquipmentJson from '../hero_equipment.json';
import petsJson from '../pets.json';

export const heroes = heroesJson as unknown as HeroesData;
export const heroEquipment = heroEquipmentJson as unknown as HeroEquipmentMap;
export const pets = petsJson as unknown as PetsData;

export function getHero(name: string): HeroData | undefined {
  return heroes[name];
}

export function getEquipment(name: string): HeroEquipmentData | undefined {
  return heroEquipment[name];
}

export function getPet(name: string): PetData | undefined {
  return pets[name];
}
