import type { PlacedBuilding } from '../types/village.ts';

export interface NPCBase {
  id: string;
  name: string;
  townHallLevel: number;
  buildings: PlacedBuilding[];
  trophyOffer: number;
  loot: { gold: number; elixir: number; darkElixir: number };
}

type BType = PlacedBuilding['buildingType'];
const D: BType = 'defense';
const C: BType = 'resource_collector';
const S: BType = 'resource_storage';
const O: BType = 'other';

function b(id: string, bid: string, bt: BType, lv: number, x: number, y: number, uc?: number): PlacedBuilding {
  return {
    instanceId: id, buildingId: bid, buildingType: bt, level: lv, gridX: x, gridY: y,
    isUpgrading: false, upgradeTimeRemaining: 0, assignedBuilder: null,
    ...(uc !== undefined ? { uncollectedResources: uc } : {}),
  };
}

function base(id: string, name: string, th: number, tp: number, loot: [number, number, number], buildings: PlacedBuilding[]): NPCBase {
  return { id, name, townHallLevel: th, trophyOffer: tp, loot: { gold: loot[0], elixir: loot[1], darkElixir: loot[2] }, buildings };
}

// TH1: Town Hall, Cannon, Gold Mine, Elixir Collector, Gold Storage, Elixir Storage
const th1Bases: NPCBase[] = [
  base('npc_th1_1', 'Goblin Outpost', 1, 5, [500, 500, 0], [
    b('t1a_th', 'Town Hall', O, 1, 20, 20), b('t1a_c', 'Cannon', D, 1, 18, 16),
    b('t1a_gm', 'Gold Mine', C, 1, 24, 18, 200), b('t1a_ec', 'Elixir Collector', C, 1, 16, 22, 200),
    b('t1a_gs', 'Gold Storage', S, 1, 22, 24), b('t1a_es', 'Elixir Storage', S, 1, 18, 24),
  ]),
  base('npc_th1_2', 'Goblin Shack', 1, 5, [600, 400, 0], [
    b('t1b_th', 'Town Hall', O, 1, 22, 22), b('t1b_c', 'Cannon', D, 1, 20, 18),
    b('t1b_gm', 'Gold Mine', C, 1, 26, 20, 250), b('t1b_ec', 'Elixir Collector', C, 1, 18, 26, 150),
    b('t1b_gs', 'Gold Storage', S, 1, 24, 26), b('t1b_es', 'Elixir Storage', S, 1, 20, 26),
  ]),
  base('npc_th1_3', 'Goblin Clearing', 1, 6, [700, 600, 0], [
    b('t1c_th', 'Town Hall', O, 1, 21, 21), b('t1c_c', 'Cannon', D, 1, 25, 19),
    b('t1c_gm', 'Gold Mine', C, 1, 17, 21, 300), b('t1c_ec', 'Elixir Collector', C, 1, 25, 23, 250),
    b('t1c_gs', 'Gold Storage', S, 1, 19, 25), b('t1c_es', 'Elixir Storage', S, 1, 23, 25),
  ]),
];

// TH2: + Archer Tower, extra collectors
const th2Bases: NPCBase[] = [
  base('npc_th2_1', 'Goblin Hollow', 2, 8, [1200, 1000, 0], [
    b('t2a_th', 'Town Hall', O, 2, 20, 20), b('t2a_c', 'Cannon', D, 2, 18, 16),
    b('t2a_at', 'Archer Tower', D, 1, 24, 16),
    b('t2a_gm', 'Gold Mine', C, 2, 16, 20, 400), b('t2a_ec', 'Elixir Collector', C, 2, 26, 20, 350),
    b('t2a_gs', 'Gold Storage', S, 2, 20, 24), b('t2a_es', 'Elixir Storage', S, 2, 24, 24),
  ]),
  base('npc_th2_2', 'Goblin Crossing', 2, 9, [1400, 1200, 0], [
    b('t2b_th', 'Town Hall', O, 2, 22, 20), b('t2b_c', 'Cannon', D, 2, 20, 16),
    b('t2b_at', 'Archer Tower', D, 1, 26, 18),
    b('t2b_gm', 'Gold Mine', C, 2, 16, 18, 500), b('t2b_ec', 'Elixir Collector', C, 2, 16, 22, 400),
    b('t2b_gs', 'Gold Storage', S, 2, 22, 24), b('t2b_es', 'Elixir Storage', S, 2, 18, 24),
  ]),
  base('npc_th2_3', 'Goblin Bluff', 2, 10, [1500, 1300, 0], [
    b('t2c_th', 'Town Hall', O, 2, 21, 21), b('t2c_c', 'Cannon', D, 2, 17, 17),
    b('t2c_at', 'Archer Tower', D, 2, 25, 17),
    b('t2c_gm', 'Gold Mine', C, 2, 17, 25, 500), b('t2c_ec', 'Elixir Collector', C, 2, 25, 25, 450),
    b('t2c_gs', 'Gold Storage', S, 2, 19, 25), b('t2c_es', 'Elixir Storage', S, 2, 23, 25),
  ]),
];

// TH3: + Mortar, more defenses and collectors
const th3Bases: NPCBase[] = [
  base('npc_th3_1', 'Goblin Fortress', 3, 12, [3000, 2500, 0], [
    b('t3a_th', 'Town Hall', O, 3, 20, 20), b('t3a_c1', 'Cannon', D, 3, 16, 16),
    b('t3a_c2', 'Cannon', D, 2, 24, 16), b('t3a_at', 'Archer Tower', D, 2, 20, 14),
    b('t3a_mt', 'Mortar', D, 1, 20, 24),
    b('t3a_gm', 'Gold Mine', C, 3, 14, 20, 800), b('t3a_ec', 'Elixir Collector', C, 3, 26, 20, 700),
    b('t3a_gs', 'Gold Storage', S, 3, 18, 26), b('t3a_es', 'Elixir Storage', S, 3, 22, 26),
  ]),
  base('npc_th3_2', 'Goblin Quarry', 3, 13, [3500, 3000, 0], [
    b('t3b_th', 'Town Hall', O, 3, 22, 22), b('t3b_c1', 'Cannon', D, 3, 18, 18),
    b('t3b_c2', 'Cannon', D, 3, 26, 18), b('t3b_at', 'Archer Tower', D, 3, 22, 16),
    b('t3b_mt', 'Mortar', D, 1, 22, 26),
    b('t3b_gm', 'Gold Mine', C, 3, 16, 22, 900), b('t3b_ec', 'Elixir Collector', C, 3, 28, 22, 800),
    b('t3b_gs', 'Gold Storage', S, 3, 20, 28), b('t3b_es', 'Elixir Storage', S, 3, 24, 28),
  ]),
  base('npc_th3_3', 'Goblin Ramparts', 3, 14, [4000, 3500, 0], [
    b('t3c_th', 'Town Hall', O, 3, 21, 21), b('t3c_c1', 'Cannon', D, 3, 17, 15),
    b('t3c_c2', 'Cannon', D, 3, 25, 15), b('t3c_at', 'Archer Tower', D, 3, 21, 15),
    b('t3c_mt', 'Mortar', D, 2, 21, 25),
    b('t3c_gm', 'Gold Mine', C, 3, 15, 21, 1000), b('t3c_ec', 'Elixir Collector', C, 3, 27, 21, 850),
    b('t3c_gs', 'Gold Storage', S, 3, 19, 27), b('t3c_es', 'Elixir Storage', S, 3, 23, 27),
  ]),
];

// TH4: + Air Defense, more defenses
const th4Bases: NPCBase[] = [
  base('npc_th4_1', 'Goblin Garrison', 4, 16, [8000, 7000, 0], [
    b('t4a_th', 'Town Hall', O, 4, 20, 20), b('t4a_c1', 'Cannon', D, 4, 16, 14),
    b('t4a_c2', 'Cannon', D, 4, 24, 14), b('t4a_at1', 'Archer Tower', D, 3, 14, 18),
    b('t4a_at2', 'Archer Tower', D, 3, 26, 18), b('t4a_mt', 'Mortar', D, 2, 20, 16),
    b('t4a_ad', 'Air Defense', D, 1, 20, 24),
    b('t4a_gm', 'Gold Mine', C, 4, 14, 22, 1500), b('t4a_ec', 'Elixir Collector', C, 4, 26, 22, 1300),
    b('t4a_gs', 'Gold Storage', S, 4, 18, 28), b('t4a_es', 'Elixir Storage', S, 4, 22, 28),
  ]),
  base('npc_th4_2', 'Goblin Lookout', 4, 17, [9000, 8000, 0], [
    b('t4b_th', 'Town Hall', O, 4, 22, 22), b('t4b_c1', 'Cannon', D, 4, 18, 16),
    b('t4b_c2', 'Cannon', D, 4, 26, 16), b('t4b_at', 'Archer Tower', D, 4, 22, 14),
    b('t4b_mt', 'Mortar', D, 3, 18, 22), b('t4b_ad', 'Air Defense', D, 2, 26, 22),
    b('t4b_gm', 'Gold Mine', C, 4, 14, 20, 1800), b('t4b_ec', 'Elixir Collector', C, 4, 30, 20, 1500),
    b('t4b_gs', 'Gold Storage', S, 4, 18, 28), b('t4b_es', 'Elixir Storage', S, 4, 26, 28),
  ]),
  base('npc_th4_3', 'Goblin Encampment', 4, 18, [10000, 9000, 0], [
    b('t4c_th', 'Town Hall', O, 4, 21, 21), b('t4c_c1', 'Cannon', D, 5, 15, 17),
    b('t4c_c2', 'Cannon', D, 4, 27, 17), b('t4c_at1', 'Archer Tower', D, 4, 15, 25),
    b('t4c_at2', 'Archer Tower', D, 4, 27, 25), b('t4c_mt', 'Mortar', D, 3, 21, 17),
    b('t4c_ad', 'Air Defense', D, 2, 21, 25),
    b('t4c_gm', 'Gold Mine', C, 4, 13, 21, 2000), b('t4c_ec', 'Elixir Collector', C, 4, 29, 21, 1700),
    b('t4c_gs', 'Gold Storage', S, 4, 17, 29), b('t4c_es', 'Elixir Storage', S, 4, 25, 29),
  ]),
];

// TH5: + Wizard Tower, full defense lineup
const th5Bases: NPCBase[] = [
  base('npc_th5_1', 'Goblin Citadel', 5, 22, [20000, 18000, 0], [
    b('t5a_th', 'Town Hall', O, 5, 20, 20), b('t5a_c1', 'Cannon', D, 5, 14, 14),
    b('t5a_c2', 'Cannon', D, 5, 26, 14), b('t5a_at1', 'Archer Tower', D, 5, 14, 20),
    b('t5a_at2', 'Archer Tower', D, 5, 26, 20), b('t5a_mt', 'Mortar', D, 3, 20, 24),
    b('t5a_ad', 'Air Defense', D, 3, 18, 18), b('t5a_wt', 'Wizard Tower', D, 1, 22, 18),
    b('t5a_gm', 'Gold Mine', C, 5, 12, 24, 3000), b('t5a_ec', 'Elixir Collector', C, 5, 28, 24, 2800),
    b('t5a_gs', 'Gold Storage', S, 5, 16, 28), b('t5a_es', 'Elixir Storage', S, 5, 24, 28),
  ]),
  base('npc_th5_2', 'Goblin War Camp', 5, 24, [22000, 20000, 0], [
    b('t5b_th', 'Town Hall', O, 5, 22, 22), b('t5b_c1', 'Cannon', D, 6, 18, 16),
    b('t5b_c2', 'Cannon', D, 5, 26, 16), b('t5b_at1', 'Archer Tower', D, 5, 22, 14),
    b('t5b_at2', 'Archer Tower', D, 5, 14, 22), b('t5b_mt', 'Mortar', D, 4, 26, 26),
    b('t5b_ad', 'Air Defense', D, 3, 22, 26), b('t5b_wt', 'Wizard Tower', D, 2, 18, 22),
    b('t5b_gm', 'Gold Mine', C, 5, 14, 16, 3500), b('t5b_ec', 'Elixir Collector', C, 5, 30, 16, 3200),
    b('t5b_gs', 'Gold Storage', S, 5, 22, 30), b('t5b_es', 'Elixir Storage', S, 5, 26, 30),
  ]),
  base('npc_th5_3', 'Goblin Capital', 5, 26, [25000, 22000, 0], [
    b('t5c_th', 'Town Hall', O, 5, 21, 21), b('t5c_c1', 'Cannon', D, 6, 15, 15),
    b('t5c_c2', 'Cannon', D, 6, 27, 15), b('t5c_at1', 'Archer Tower', D, 6, 15, 27),
    b('t5c_at2', 'Archer Tower', D, 6, 27, 27), b('t5c_mt', 'Mortar', D, 4, 17, 21),
    b('t5c_ad', 'Air Defense', D, 4, 25, 21), b('t5c_wt', 'Wizard Tower', D, 2, 21, 25),
    b('t5c_gm', 'Gold Mine', C, 5, 11, 21, 4000), b('t5c_ec', 'Elixir Collector', C, 5, 31, 21, 3800),
    b('t5c_gs', 'Gold Storage', S, 5, 19, 29), b('t5c_es', 'Elixir Storage', S, 5, 23, 29),
  ]),
];

export const npcBases: NPCBase[] = [
  ...th1Bases, ...th2Bases, ...th3Bases, ...th4Bases, ...th5Bases,
];

export function getNPCBasesForTH(thLevel: number): NPCBase[] {
  return npcBases.filter((base) => base.townHallLevel <= thLevel + 1);
}

export function getRandomNPCBase(thLevel: number): NPCBase | undefined {
  const available = getNPCBasesForTH(thLevel);
  if (available.length === 0) return undefined;
  return available[Math.floor(Math.random() * available.length)];
}
