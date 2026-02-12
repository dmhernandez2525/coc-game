import type {
  WallData,
  TrapData,
  THWeaponData,
  SiegeMachineData,
  SuperTroopData,
} from '../../types';
import economyJson from '../economy.json';
import buildersJson from '../builders.json';
import gemsAndItemsJson from '../gems_and_items.json';
import clansJson from '../clans.json';
import campaignJson from '../single_player_campaign.json';
import wallsJson from '../walls.json';
import trapsJson from '../traps.json';
import thWeaponsJson from '../th_weapons.json';
import siegeMachinesJson from '../siege_machines.json';
import superTroopsJson from '../super_troops.json';

// These complex nested JSON files are exported as-is with typed aliases.
// The specific shape of economy, builders, gems, clans, and campaign data
// varies significantly, so consumers should access nested fields directly.

export const economyData = economyJson;
export const buildersData = buildersJson;
export const gemsAndItemsData = gemsAndItemsJson;
export const clansData = clansJson;
export const campaignData = campaignJson;

export const wallData = wallsJson as WallData;
export const traps = trapsJson as TrapData[];
export const thWeapons = thWeaponsJson as THWeaponData[];
export const siegeMachines = siegeMachinesJson as SiegeMachineData[];
export const superTroops = superTroopsJson as SuperTroopData[];
