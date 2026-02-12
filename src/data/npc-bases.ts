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

// TH6: + Air Sweeper, more defenses
const th6Bases: NPCBase[] = [
  base('npc_th6_1', 'Goblin Stronghold', 6, 28, [40000, 38000, 0], [
    b('t6a_th', 'Town Hall', O, 6, 20, 20), b('t6a_c1', 'Cannon', D, 6, 14, 14),
    b('t6a_c2', 'Cannon', D, 6, 26, 14), b('t6a_at1', 'Archer Tower', D, 6, 14, 26),
    b('t6a_at2', 'Archer Tower', D, 6, 26, 26), b('t6a_mt', 'Mortar', D, 4, 20, 16),
    b('t6a_ad', 'Air Defense', D, 4, 18, 22), b('t6a_wt', 'Wizard Tower', D, 3, 22, 22),
    b('t6a_as', 'Air Sweeper', D, 1, 24, 18),
    b('t6a_gm', 'Gold Mine', C, 6, 10, 20, 5000), b('t6a_ec', 'Elixir Collector', C, 6, 30, 20, 4800),
    b('t6a_gs', 'Gold Storage', S, 6, 16, 28), b('t6a_es', 'Elixir Storage', S, 6, 24, 28),
  ]),
  base('npc_th6_2', 'Goblin Armory', 6, 30, [50000, 45000, 0], [
    b('t6b_th', 'Town Hall', O, 6, 22, 22), b('t6b_c1', 'Cannon', D, 7, 16, 16),
    b('t6b_c2', 'Cannon', D, 6, 28, 16), b('t6b_at1', 'Archer Tower', D, 6, 16, 28),
    b('t6b_at2', 'Archer Tower', D, 6, 28, 28), b('t6b_mt', 'Mortar', D, 5, 22, 18),
    b('t6b_ad', 'Air Defense', D, 4, 22, 26), b('t6b_wt', 'Wizard Tower', D, 3, 18, 22),
    b('t6b_as', 'Air Sweeper', D, 2, 26, 20),
    b('t6b_gm', 'Gold Mine', C, 6, 12, 22, 6000), b('t6b_ec', 'Elixir Collector', C, 6, 32, 22, 5500),
    b('t6b_gs', 'Gold Storage', S, 6, 18, 30), b('t6b_es', 'Elixir Storage', S, 6, 26, 30),
  ]),
  base('npc_th6_3', 'Goblin Keep', 6, 32, [60000, 55000, 0], [
    b('t6c_th', 'Town Hall', O, 6, 21, 21), b('t6c_c1', 'Cannon', D, 7, 15, 13),
    b('t6c_c2', 'Cannon', D, 7, 27, 13), b('t6c_at1', 'Archer Tower', D, 7, 13, 27),
    b('t6c_at2', 'Archer Tower', D, 7, 29, 27), b('t6c_mt', 'Mortar', D, 5, 21, 17),
    b('t6c_ad', 'Air Defense', D, 5, 21, 25), b('t6c_wt', 'Wizard Tower', D, 3, 17, 21),
    b('t6c_as', 'Air Sweeper', D, 2, 25, 19),
    b('t6c_gm', 'Gold Mine', C, 6, 9, 21, 7000), b('t6c_ec', 'Elixir Collector', C, 6, 33, 21, 6500),
    b('t6c_gs', 'Gold Storage', S, 6, 17, 29), b('t6c_es', 'Elixir Storage', S, 6, 25, 29),
  ]),
];

// TH7: + Hidden Tesla, Dark Elixir resources
const th7Bases: NPCBase[] = [
  base('npc_th7_1', 'Goblin Bastion', 7, 30, [80000, 75000, 200], [
    b('t7a_th', 'Town Hall', O, 7, 20, 20), b('t7a_c1', 'Cannon', D, 8, 14, 12),
    b('t7a_c2', 'Cannon', D, 8, 26, 12), b('t7a_at1', 'Archer Tower', D, 7, 12, 22),
    b('t7a_at2', 'Archer Tower', D, 7, 28, 22), b('t7a_mt1', 'Mortar', D, 5, 18, 16),
    b('t7a_mt2', 'Mortar', D, 5, 22, 16), b('t7a_ad', 'Air Defense', D, 5, 20, 24),
    b('t7a_wt', 'Wizard Tower', D, 4, 16, 20), b('t7a_ht', 'Hidden Tesla', D, 1, 24, 20),
    b('t7a_gm', 'Gold Mine', C, 7, 10, 26, 8000), b('t7a_ec', 'Elixir Collector', C, 7, 30, 26, 7500),
    b('t7a_dd', 'Dark Elixir Drill', C, 1, 20, 28, 100),
    b('t7a_gs', 'Gold Storage', S, 7, 14, 28), b('t7a_es', 'Elixir Storage', S, 7, 26, 28),
    b('t7a_ds', 'Dark Elixir Storage', S, 1, 20, 12),
  ]),
  base('npc_th7_2', 'Goblin Watchtower', 7, 34, [100000, 95000, 350], [
    b('t7b_th', 'Town Hall', O, 7, 22, 22), b('t7b_c1', 'Cannon', D, 8, 16, 14),
    b('t7b_c2', 'Cannon', D, 8, 28, 14), b('t7b_at1', 'Archer Tower', D, 8, 14, 24),
    b('t7b_at2', 'Archer Tower', D, 8, 30, 24), b('t7b_mt1', 'Mortar', D, 6, 20, 18),
    b('t7b_mt2', 'Mortar', D, 5, 24, 18), b('t7b_ad', 'Air Defense', D, 5, 22, 26),
    b('t7b_wt', 'Wizard Tower', D, 4, 18, 22), b('t7b_ht', 'Hidden Tesla', D, 2, 26, 22),
    b('t7b_gm', 'Gold Mine', C, 7, 12, 28, 10000), b('t7b_ec', 'Elixir Collector', C, 7, 32, 28, 9000),
    b('t7b_dd', 'Dark Elixir Drill', C, 2, 22, 30, 150),
    b('t7b_gs', 'Gold Storage', S, 7, 16, 30), b('t7b_es', 'Elixir Storage', S, 7, 28, 30),
    b('t7b_ds', 'Dark Elixir Storage', S, 2, 22, 12),
  ]),
  base('npc_th7_3', 'Goblin Vault', 7, 36, [120000, 110000, 500], [
    b('t7c_th', 'Town Hall', O, 7, 21, 21), b('t7c_c1', 'Cannon', D, 9, 13, 13),
    b('t7c_c2', 'Cannon', D, 9, 29, 13), b('t7c_at1', 'Archer Tower', D, 8, 13, 29),
    b('t7c_at2', 'Archer Tower', D, 8, 29, 29), b('t7c_mt1', 'Mortar', D, 6, 17, 17),
    b('t7c_mt2', 'Mortar', D, 6, 25, 17), b('t7c_ad', 'Air Defense', D, 6, 21, 25),
    b('t7c_wt', 'Wizard Tower', D, 4, 19, 21), b('t7c_ht', 'Hidden Tesla', D, 3, 23, 21),
    b('t7c_gm', 'Gold Mine', C, 7, 9, 21, 12000), b('t7c_ec', 'Elixir Collector', C, 7, 33, 21, 11000),
    b('t7c_dd', 'Dark Elixir Drill', C, 2, 21, 29, 200),
    b('t7c_gs', 'Gold Storage', S, 7, 15, 31), b('t7c_es', 'Elixir Storage', S, 7, 27, 31),
    b('t7c_ds', 'Dark Elixir Storage', S, 2, 21, 11),
  ]),
];

// TH8: + Bomb Tower
const th8Bases: NPCBase[] = [
  base('npc_th8_1', 'Goblin Forge', 8, 32, [150000, 140000, 800], [
    b('t8a_th', 'Town Hall', O, 8, 20, 20), b('t8a_c1', 'Cannon', D, 10, 12, 12),
    b('t8a_c2', 'Cannon', D, 10, 28, 12), b('t8a_at1', 'Archer Tower', D, 9, 12, 28),
    b('t8a_at2', 'Archer Tower', D, 9, 28, 28), b('t8a_mt1', 'Mortar', D, 6, 16, 16),
    b('t8a_mt2', 'Mortar', D, 6, 24, 16), b('t8a_ad1', 'Air Defense', D, 6, 18, 24),
    b('t8a_ad2', 'Air Defense', D, 6, 22, 24), b('t8a_wt1', 'Wizard Tower', D, 5, 16, 20),
    b('t8a_wt2', 'Wizard Tower', D, 5, 24, 20), b('t8a_ht', 'Hidden Tesla', D, 3, 20, 16),
    b('t8a_bt', 'Bomb Tower', D, 1, 20, 24),
    b('t8a_gm', 'Gold Mine', C, 8, 8, 20, 15000), b('t8a_ec', 'Elixir Collector', C, 8, 32, 20, 14000),
    b('t8a_dd', 'Dark Elixir Drill', C, 3, 20, 30, 300),
    b('t8a_gs', 'Gold Storage', S, 8, 14, 30), b('t8a_es', 'Elixir Storage', S, 8, 26, 30),
    b('t8a_ds', 'Dark Elixir Storage', S, 3, 20, 10),
  ]),
  base('npc_th8_2', 'Goblin Arena', 8, 35, [175000, 165000, 1000], [
    b('t8b_th', 'Town Hall', O, 8, 22, 22), b('t8b_c1', 'Cannon', D, 10, 14, 14),
    b('t8b_c2', 'Cannon', D, 10, 30, 14), b('t8b_at1', 'Archer Tower', D, 10, 14, 30),
    b('t8b_at2', 'Archer Tower', D, 10, 30, 30), b('t8b_mt1', 'Mortar', D, 7, 18, 18),
    b('t8b_mt2', 'Mortar', D, 7, 26, 18), b('t8b_ad1', 'Air Defense', D, 6, 20, 26),
    b('t8b_ad2', 'Air Defense', D, 6, 24, 26), b('t8b_wt1', 'Wizard Tower', D, 5, 18, 22),
    b('t8b_wt2', 'Wizard Tower', D, 5, 26, 22), b('t8b_ht', 'Hidden Tesla', D, 4, 22, 18),
    b('t8b_bt', 'Bomb Tower', D, 2, 22, 26),
    b('t8b_gm', 'Gold Mine', C, 8, 10, 22, 18000), b('t8b_ec', 'Elixir Collector', C, 8, 34, 22, 16000),
    b('t8b_dd', 'Dark Elixir Drill', C, 3, 22, 32, 400),
    b('t8b_gs', 'Gold Storage', S, 8, 16, 32), b('t8b_es', 'Elixir Storage', S, 8, 28, 32),
    b('t8b_ds', 'Dark Elixir Storage', S, 3, 22, 12),
  ]),
  base('npc_th8_3', 'Goblin Warlord', 8, 38, [200000, 190000, 1200], [
    b('t8c_th', 'Town Hall', O, 8, 21, 21), b('t8c_c1', 'Cannon', D, 11, 11, 11),
    b('t8c_c2', 'Cannon', D, 11, 31, 11), b('t8c_at1', 'Archer Tower', D, 10, 11, 31),
    b('t8c_at2', 'Archer Tower', D, 10, 31, 31), b('t8c_mt1', 'Mortar', D, 7, 17, 15),
    b('t8c_mt2', 'Mortar', D, 7, 25, 15), b('t8c_ad1', 'Air Defense', D, 7, 17, 25),
    b('t8c_ad2', 'Air Defense', D, 7, 25, 25), b('t8c_wt1', 'Wizard Tower', D, 6, 15, 21),
    b('t8c_wt2', 'Wizard Tower', D, 6, 27, 21), b('t8c_ht', 'Hidden Tesla', D, 5, 21, 17),
    b('t8c_bt', 'Bomb Tower', D, 2, 21, 27),
    b('t8c_gm', 'Gold Mine', C, 8, 7, 21, 20000), b('t8c_ec', 'Elixir Collector', C, 8, 35, 21, 19000),
    b('t8c_dd', 'Dark Elixir Drill', C, 3, 21, 33, 500),
    b('t8c_gs', 'Gold Storage', S, 8, 13, 33), b('t8c_es', 'Elixir Storage', S, 8, 29, 33),
    b('t8c_ds', 'Dark Elixir Storage', S, 4, 21, 9),
  ]),
];

// TH9: + X-Bow
const th9Bases: NPCBase[] = [
  base('npc_th9_1', 'Goblin Citadel II', 9, 34, [250000, 240000, 1500], [
    b('t9a_th', 'Town Hall', O, 9, 20, 20), b('t9a_c1', 'Cannon', D, 11, 12, 10),
    b('t9a_c2', 'Cannon', D, 11, 28, 10), b('t9a_at1', 'Archer Tower', D, 11, 10, 26),
    b('t9a_at2', 'Archer Tower', D, 11, 30, 26), b('t9a_mt1', 'Mortar', D, 7, 16, 14),
    b('t9a_ad1', 'Air Defense', D, 7, 16, 24), b('t9a_ad2', 'Air Defense', D, 7, 24, 24),
    b('t9a_wt1', 'Wizard Tower', D, 6, 16, 20), b('t9a_wt2', 'Wizard Tower', D, 6, 24, 20),
    b('t9a_ht1', 'Hidden Tesla', D, 5, 18, 16), b('t9a_ht2', 'Hidden Tesla', D, 5, 22, 16),
    b('t9a_xb', 'X-Bow', D, 1, 20, 24),
    b('t9a_gm', 'Gold Mine', C, 9, 8, 20, 22000), b('t9a_ec', 'Elixir Collector', C, 9, 32, 20, 21000),
    b('t9a_dd', 'Dark Elixir Drill', C, 4, 20, 30, 600),
    b('t9a_gs', 'Gold Storage', S, 9, 12, 30), b('t9a_es', 'Elixir Storage', S, 9, 28, 30),
    b('t9a_ds', 'Dark Elixir Storage', S, 4, 20, 8),
  ]),
  base('npc_th9_2', 'Goblin War Machine', 9, 37, [300000, 290000, 2000], [
    b('t9b_th', 'Town Hall', O, 9, 22, 22), b('t9b_c1', 'Cannon', D, 12, 14, 12),
    b('t9b_c2', 'Cannon', D, 12, 30, 12), b('t9b_at1', 'Archer Tower', D, 11, 12, 28),
    b('t9b_at2', 'Archer Tower', D, 11, 32, 28), b('t9b_mt1', 'Mortar', D, 8, 18, 16),
    b('t9b_ad1', 'Air Defense', D, 7, 18, 26), b('t9b_ad2', 'Air Defense', D, 7, 26, 26),
    b('t9b_wt1', 'Wizard Tower', D, 7, 18, 22), b('t9b_wt2', 'Wizard Tower', D, 7, 26, 22),
    b('t9b_ht1', 'Hidden Tesla', D, 6, 20, 18), b('t9b_ht2', 'Hidden Tesla', D, 6, 24, 18),
    b('t9b_xb1', 'X-Bow', D, 2, 20, 26), b('t9b_xb2', 'X-Bow', D, 2, 24, 26),
    b('t9b_gm', 'Gold Mine', C, 9, 10, 22, 25000), b('t9b_ec', 'Elixir Collector', C, 9, 34, 22, 24000),
    b('t9b_dd', 'Dark Elixir Drill', C, 4, 22, 32, 800),
    b('t9b_gs', 'Gold Storage', S, 9, 14, 32), b('t9b_es', 'Elixir Storage', S, 9, 30, 32),
    b('t9b_ds', 'Dark Elixir Storage', S, 5, 22, 10),
  ]),
  base('npc_th9_3', 'Goblin Overlord', 9, 40, [350000, 340000, 2500], [
    b('t9c_th', 'Town Hall', O, 9, 21, 21), b('t9c_c1', 'Cannon', D, 12, 11, 11),
    b('t9c_c2', 'Cannon', D, 12, 31, 11), b('t9c_at1', 'Archer Tower', D, 12, 11, 31),
    b('t9c_at2', 'Archer Tower', D, 12, 31, 31), b('t9c_mt1', 'Mortar', D, 8, 17, 15),
    b('t9c_ad1', 'Air Defense', D, 8, 17, 27), b('t9c_ad2', 'Air Defense', D, 8, 25, 27),
    b('t9c_wt1', 'Wizard Tower', D, 7, 15, 21), b('t9c_wt2', 'Wizard Tower', D, 7, 27, 21),
    b('t9c_ht1', 'Hidden Tesla', D, 7, 19, 17), b('t9c_ht2', 'Hidden Tesla', D, 7, 23, 17),
    b('t9c_xb1', 'X-Bow', D, 3, 19, 25), b('t9c_xb2', 'X-Bow', D, 3, 23, 25),
    b('t9c_gm', 'Gold Mine', C, 9, 7, 21, 28000), b('t9c_ec', 'Elixir Collector', C, 9, 35, 21, 27000),
    b('t9c_dd', 'Dark Elixir Drill', C, 5, 21, 33, 1000),
    b('t9c_gs', 'Gold Storage', S, 9, 13, 33), b('t9c_es', 'Elixir Storage', S, 9, 29, 33),
    b('t9c_ds', 'Dark Elixir Storage', S, 5, 21, 9),
  ]),
];

// TH10: + Inferno Tower
const th10Bases: NPCBase[] = [
  base('npc_th10_1', 'Goblin Inferno', 10, 36, [400000, 380000, 3000], [
    b('t10a_th', 'Town Hall', O, 10, 20, 20), b('t10a_c1', 'Cannon', D, 13, 10, 10),
    b('t10a_c2', 'Cannon', D, 13, 30, 10), b('t10a_at1', 'Archer Tower', D, 12, 10, 30),
    b('t10a_at2', 'Archer Tower', D, 12, 30, 30),
    b('t10a_ad1', 'Air Defense', D, 8, 16, 24), b('t10a_ad2', 'Air Defense', D, 8, 24, 24),
    b('t10a_wt1', 'Wizard Tower', D, 8, 16, 18), b('t10a_wt2', 'Wizard Tower', D, 8, 24, 18),
    b('t10a_xb1', 'X-Bow', D, 3, 18, 22), b('t10a_xb2', 'X-Bow', D, 3, 22, 22),
    b('t10a_it', 'Inferno Tower', D, 1, 20, 16),
    b('t10a_gm', 'Gold Mine', C, 10, 6, 20, 30000), b('t10a_ec', 'Elixir Collector', C, 10, 34, 20, 28000),
    b('t10a_dd', 'Dark Elixir Drill', C, 5, 20, 32, 1200),
    b('t10a_gs', 'Gold Storage', S, 10, 12, 32), b('t10a_es', 'Elixir Storage', S, 10, 28, 32),
    b('t10a_ds', 'Dark Elixir Storage', S, 5, 20, 8),
  ]),
  base('npc_th10_2', 'Goblin Hellfire', 10, 39, [450000, 430000, 3500], [
    b('t10b_th', 'Town Hall', O, 10, 22, 22), b('t10b_c1', 'Cannon', D, 14, 12, 12),
    b('t10b_c2', 'Cannon', D, 14, 32, 12), b('t10b_at1', 'Archer Tower', D, 13, 12, 32),
    b('t10b_at2', 'Archer Tower', D, 13, 32, 32),
    b('t10b_ad1', 'Air Defense', D, 8, 18, 26), b('t10b_ad2', 'Air Defense', D, 8, 26, 26),
    b('t10b_wt1', 'Wizard Tower', D, 8, 18, 20), b('t10b_wt2', 'Wizard Tower', D, 8, 26, 20),
    b('t10b_xb1', 'X-Bow', D, 4, 20, 24), b('t10b_xb2', 'X-Bow', D, 4, 24, 24),
    b('t10b_it1', 'Inferno Tower', D, 2, 22, 18), b('t10b_it2', 'Inferno Tower', D, 2, 22, 28),
    b('t10b_gm', 'Gold Mine', C, 10, 8, 22, 35000), b('t10b_ec', 'Elixir Collector', C, 10, 36, 22, 33000),
    b('t10b_dd', 'Dark Elixir Drill', C, 6, 22, 34, 1500),
    b('t10b_gs', 'Gold Storage', S, 10, 14, 34), b('t10b_es', 'Elixir Storage', S, 10, 30, 34),
    b('t10b_ds', 'Dark Elixir Storage', S, 6, 22, 10),
  ]),
  base('npc_th10_3', 'Goblin Dreadnought', 10, 42, [500000, 480000, 4000], [
    b('t10c_th', 'Town Hall', O, 10, 21, 21), b('t10c_c1', 'Cannon', D, 14, 9, 9),
    b('t10c_c2', 'Cannon', D, 14, 33, 9), b('t10c_at1', 'Archer Tower', D, 13, 9, 33),
    b('t10c_at2', 'Archer Tower', D, 13, 33, 33),
    b('t10c_ad1', 'Air Defense', D, 9, 15, 25), b('t10c_ad2', 'Air Defense', D, 9, 27, 25),
    b('t10c_wt1', 'Wizard Tower', D, 9, 15, 19), b('t10c_wt2', 'Wizard Tower', D, 9, 27, 19),
    b('t10c_xb1', 'X-Bow', D, 4, 19, 23), b('t10c_xb2', 'X-Bow', D, 4, 23, 23),
    b('t10c_it1', 'Inferno Tower', D, 3, 21, 17), b('t10c_it2', 'Inferno Tower', D, 3, 21, 27),
    b('t10c_gm', 'Gold Mine', C, 10, 5, 21, 40000), b('t10c_ec', 'Elixir Collector', C, 10, 37, 21, 38000),
    b('t10c_dd', 'Dark Elixir Drill', C, 6, 21, 35, 1800),
    b('t10c_gs', 'Gold Storage', S, 10, 11, 35), b('t10c_es', 'Elixir Storage', S, 10, 31, 35),
    b('t10c_ds', 'Dark Elixir Storage', S, 6, 21, 7),
  ]),
];

// TH11: + Eagle Artillery
const th11Bases: NPCBase[] = [
  base('npc_th11_1', 'Goblin Citadel III', 11, 38, [500000, 480000, 4000], [
    b('t11a_th', 'Town Hall', O, 11, 20, 20), b('t11a_c1', 'Cannon', D, 15, 10, 10),
    b('t11a_c2', 'Cannon', D, 15, 30, 10), b('t11a_at1', 'Archer Tower', D, 14, 10, 30),
    b('t11a_at2', 'Archer Tower', D, 14, 30, 30),
    b('t11a_ad1', 'Air Defense', D, 9, 16, 24), b('t11a_xb1', 'X-Bow', D, 4, 18, 22),
    b('t11a_xb2', 'X-Bow', D, 4, 22, 22), b('t11a_it1', 'Inferno Tower', D, 3, 16, 18),
    b('t11a_it2', 'Inferno Tower', D, 3, 24, 18), b('t11a_ea', 'Eagle Artillery', D, 1, 20, 26),
    b('t11a_wt', 'Wizard Tower', D, 9, 20, 16),
    b('t11a_gm', 'Gold Mine', C, 11, 6, 20, 45000), b('t11a_ec', 'Elixir Collector', C, 11, 34, 20, 43000),
    b('t11a_dd', 'Dark Elixir Drill', C, 6, 20, 32, 2000),
    b('t11a_gs', 'Gold Storage', S, 11, 12, 32), b('t11a_es', 'Elixir Storage', S, 11, 28, 32),
    b('t11a_ds', 'Dark Elixir Storage', S, 6, 20, 8),
  ]),
  base('npc_th11_2', 'Goblin Grand Marshal', 11, 41, [600000, 580000, 5000], [
    b('t11b_th', 'Town Hall', O, 11, 22, 22), b('t11b_c1', 'Cannon', D, 16, 12, 12),
    b('t11b_c2', 'Cannon', D, 16, 32, 12), b('t11b_at1', 'Archer Tower', D, 15, 12, 32),
    b('t11b_at2', 'Archer Tower', D, 15, 32, 32),
    b('t11b_ad1', 'Air Defense', D, 10, 18, 26), b('t11b_xb1', 'X-Bow', D, 5, 20, 24),
    b('t11b_xb2', 'X-Bow', D, 5, 24, 24), b('t11b_it1', 'Inferno Tower', D, 4, 18, 20),
    b('t11b_it2', 'Inferno Tower', D, 4, 26, 20), b('t11b_ea', 'Eagle Artillery', D, 2, 22, 28),
    b('t11b_wt', 'Wizard Tower', D, 9, 22, 18),
    b('t11b_gm', 'Gold Mine', C, 11, 8, 22, 50000), b('t11b_ec', 'Elixir Collector', C, 11, 36, 22, 48000),
    b('t11b_dd', 'Dark Elixir Drill', C, 7, 22, 34, 2500),
    b('t11b_gs', 'Gold Storage', S, 11, 14, 34), b('t11b_es', 'Elixir Storage', S, 11, 30, 34),
    b('t11b_ds', 'Dark Elixir Storage', S, 7, 22, 10),
  ]),
  base('npc_th11_3', 'Goblin Emperor', 11, 44, [700000, 680000, 6000], [
    b('t11c_th', 'Town Hall', O, 11, 21, 21), b('t11c_c1', 'Cannon', D, 16, 9, 9),
    b('t11c_c2', 'Cannon', D, 16, 33, 9), b('t11c_at1', 'Archer Tower', D, 15, 9, 33),
    b('t11c_at2', 'Archer Tower', D, 15, 33, 33),
    b('t11c_ad1', 'Air Defense', D, 10, 15, 25), b('t11c_xb1', 'X-Bow', D, 5, 19, 23),
    b('t11c_xb2', 'X-Bow', D, 5, 23, 23), b('t11c_it1', 'Inferno Tower', D, 5, 15, 19),
    b('t11c_it2', 'Inferno Tower', D, 5, 27, 19), b('t11c_ea', 'Eagle Artillery', D, 2, 21, 27),
    b('t11c_wt', 'Wizard Tower', D, 10, 21, 17),
    b('t11c_gm', 'Gold Mine', C, 11, 5, 21, 55000), b('t11c_ec', 'Elixir Collector', C, 11, 37, 21, 53000),
    b('t11c_dd', 'Dark Elixir Drill', C, 7, 21, 35, 3000),
    b('t11c_gs', 'Gold Storage', S, 11, 11, 35), b('t11c_es', 'Elixir Storage', S, 11, 31, 35),
    b('t11c_ds', 'Dark Elixir Storage', S, 7, 21, 7),
  ]),
];

// TH12: + Scattershot
const th12Bases: NPCBase[] = [
  base('npc_th12_1', 'Goblin Titan', 12, 40, [600000, 580000, 5000], [
    b('t12a_th', 'Town Hall', O, 12, 20, 20), b('t12a_c1', 'Cannon', D, 17, 10, 10),
    b('t12a_c2', 'Cannon', D, 17, 30, 10), b('t12a_at1', 'Archer Tower', D, 16, 10, 30),
    b('t12a_at2', 'Archer Tower', D, 16, 30, 30),
    b('t12a_xb1', 'X-Bow', D, 5, 18, 22), b('t12a_xb2', 'X-Bow', D, 5, 22, 22),
    b('t12a_it1', 'Inferno Tower', D, 5, 16, 18), b('t12a_it2', 'Inferno Tower', D, 5, 24, 18),
    b('t12a_ea', 'Eagle Artillery', D, 2, 20, 26), b('t12a_sc', 'Scattershot', D, 1, 20, 14),
    b('t12a_wt', 'Wizard Tower', D, 10, 16, 24),
    b('t12a_gm', 'Gold Mine', C, 12, 6, 20, 55000), b('t12a_ec', 'Elixir Collector', C, 12, 34, 20, 53000),
    b('t12a_dd', 'Dark Elixir Drill', C, 7, 20, 32, 2500),
    b('t12a_gs', 'Gold Storage', S, 12, 12, 32), b('t12a_es', 'Elixir Storage', S, 12, 28, 32),
    b('t12a_ds', 'Dark Elixir Storage', S, 7, 20, 8),
  ]),
  base('npc_th12_2', 'Goblin Colossus', 12, 43, [750000, 720000, 6000], [
    b('t12b_th', 'Town Hall', O, 12, 22, 22), b('t12b_c1', 'Cannon', D, 18, 12, 12),
    b('t12b_c2', 'Cannon', D, 18, 32, 12), b('t12b_at1', 'Archer Tower', D, 17, 12, 32),
    b('t12b_at2', 'Archer Tower', D, 17, 32, 32),
    b('t12b_xb1', 'X-Bow', D, 6, 20, 24), b('t12b_xb2', 'X-Bow', D, 6, 24, 24),
    b('t12b_it1', 'Inferno Tower', D, 5, 18, 20), b('t12b_it2', 'Inferno Tower', D, 5, 26, 20),
    b('t12b_ea', 'Eagle Artillery', D, 3, 22, 28), b('t12b_sc', 'Scattershot', D, 2, 22, 16),
    b('t12b_wt', 'Wizard Tower', D, 10, 18, 26),
    b('t12b_gm', 'Gold Mine', C, 12, 8, 22, 60000), b('t12b_ec', 'Elixir Collector', C, 12, 36, 22, 58000),
    b('t12b_dd', 'Dark Elixir Drill', C, 8, 22, 34, 3000),
    b('t12b_gs', 'Gold Storage', S, 12, 14, 34), b('t12b_es', 'Elixir Storage', S, 12, 30, 34),
    b('t12b_ds', 'Dark Elixir Storage', S, 8, 22, 10),
  ]),
  base('npc_th12_3', 'Goblin Leviathan', 12, 46, [900000, 870000, 7000], [
    b('t12c_th', 'Town Hall', O, 12, 21, 21), b('t12c_c1', 'Cannon', D, 18, 9, 9),
    b('t12c_c2', 'Cannon', D, 18, 33, 9), b('t12c_at1', 'Archer Tower', D, 17, 9, 33),
    b('t12c_at2', 'Archer Tower', D, 17, 33, 33),
    b('t12c_xb1', 'X-Bow', D, 6, 19, 23), b('t12c_xb2', 'X-Bow', D, 6, 23, 23),
    b('t12c_it1', 'Inferno Tower', D, 6, 15, 19), b('t12c_it2', 'Inferno Tower', D, 6, 27, 19),
    b('t12c_ea', 'Eagle Artillery', D, 3, 21, 27), b('t12c_sc', 'Scattershot', D, 2, 21, 15),
    b('t12c_wt', 'Wizard Tower', D, 10, 15, 25),
    b('t12c_gm', 'Gold Mine', C, 12, 5, 21, 65000), b('t12c_ec', 'Elixir Collector', C, 12, 37, 21, 63000),
    b('t12c_dd', 'Dark Elixir Drill', C, 8, 21, 35, 3500),
    b('t12c_gs', 'Gold Storage', S, 12, 11, 35), b('t12c_es', 'Elixir Storage', S, 12, 31, 35),
    b('t12c_ds', 'Dark Elixir Storage', S, 8, 21, 7),
  ]),
];

// TH13-15: More defenses, higher levels, scaled loot
const th13Bases: NPCBase[] = [
  base('npc_th13_1', 'Goblin Apocalypse', 13, 42, [800000, 780000, 7000], [
    b('t13a_th', 'Town Hall', O, 13, 20, 20), b('t13a_c1', 'Cannon', D, 19, 10, 10),
    b('t13a_at1', 'Archer Tower', D, 18, 30, 10), b('t13a_xb1', 'X-Bow', D, 6, 18, 22),
    b('t13a_xb2', 'X-Bow', D, 6, 22, 22), b('t13a_it1', 'Inferno Tower', D, 6, 16, 18),
    b('t13a_it2', 'Inferno Tower', D, 6, 24, 18), b('t13a_ea', 'Eagle Artillery', D, 3, 20, 26),
    b('t13a_sc1', 'Scattershot', D, 2, 16, 14), b('t13a_sc2', 'Scattershot', D, 2, 24, 14),
    b('t13a_gm', 'Gold Mine', C, 12, 6, 20, 70000), b('t13a_ec', 'Elixir Collector', C, 12, 34, 20, 68000),
    b('t13a_dd', 'Dark Elixir Drill', C, 8, 20, 32, 3500),
    b('t13a_gs', 'Gold Storage', S, 12, 12, 32), b('t13a_es', 'Elixir Storage', S, 12, 28, 32),
    b('t13a_ds', 'Dark Elixir Storage', S, 8, 20, 8),
  ]),
  base('npc_th13_2', 'Goblin Cataclysm', 13, 45, [1000000, 980000, 8000], [
    b('t13b_th', 'Town Hall', O, 13, 22, 22), b('t13b_c1', 'Cannon', D, 19, 12, 12),
    b('t13b_at1', 'Archer Tower', D, 18, 32, 12), b('t13b_xb1', 'X-Bow', D, 7, 20, 24),
    b('t13b_xb2', 'X-Bow', D, 7, 24, 24), b('t13b_it1', 'Inferno Tower', D, 7, 18, 20),
    b('t13b_it2', 'Inferno Tower', D, 7, 26, 20), b('t13b_ea', 'Eagle Artillery', D, 4, 22, 28),
    b('t13b_sc1', 'Scattershot', D, 2, 18, 16), b('t13b_sc2', 'Scattershot', D, 2, 26, 16),
    b('t13b_gm', 'Gold Mine', C, 12, 8, 22, 80000), b('t13b_ec', 'Elixir Collector', C, 12, 36, 22, 78000),
    b('t13b_dd', 'Dark Elixir Drill', C, 9, 22, 34, 4000),
    b('t13b_gs', 'Gold Storage', S, 12, 14, 34), b('t13b_es', 'Elixir Storage', S, 12, 30, 34),
    b('t13b_ds', 'Dark Elixir Storage', S, 8, 22, 10),
  ]),
  base('npc_th13_3', 'Goblin Ragnarok', 13, 48, [1200000, 1150000, 9000], [
    b('t13c_th', 'Town Hall', O, 13, 21, 21), b('t13c_c1', 'Cannon', D, 20, 9, 9),
    b('t13c_at1', 'Archer Tower', D, 19, 33, 9), b('t13c_xb1', 'X-Bow', D, 7, 19, 23),
    b('t13c_xb2', 'X-Bow', D, 7, 23, 23), b('t13c_it1', 'Inferno Tower', D, 7, 15, 19),
    b('t13c_it2', 'Inferno Tower', D, 7, 27, 19), b('t13c_ea', 'Eagle Artillery', D, 4, 21, 27),
    b('t13c_sc1', 'Scattershot', D, 3, 15, 13), b('t13c_sc2', 'Scattershot', D, 3, 27, 13),
    b('t13c_gm', 'Gold Mine', C, 12, 5, 21, 90000), b('t13c_ec', 'Elixir Collector', C, 12, 37, 21, 88000),
    b('t13c_dd', 'Dark Elixir Drill', C, 9, 21, 35, 4500),
    b('t13c_gs', 'Gold Storage', S, 12, 11, 35), b('t13c_es', 'Elixir Storage', S, 12, 31, 35),
    b('t13c_ds', 'Dark Elixir Storage', S, 9, 21, 7),
  ]),
];

const th14Bases: NPCBase[] = [
  base('npc_th14_1', 'Goblin Pantheon', 14, 44, [1000000, 980000, 8000], [
    b('t14a_th', 'Town Hall', O, 14, 20, 20), b('t14a_c1', 'Cannon', D, 20, 10, 10),
    b('t14a_at1', 'Archer Tower', D, 19, 30, 10), b('t14a_xb1', 'X-Bow', D, 7, 18, 22),
    b('t14a_xb2', 'X-Bow', D, 7, 22, 22), b('t14a_it1', 'Inferno Tower', D, 7, 16, 18),
    b('t14a_it2', 'Inferno Tower', D, 7, 24, 18), b('t14a_ea', 'Eagle Artillery', D, 4, 20, 26),
    b('t14a_sc1', 'Scattershot', D, 3, 16, 14), b('t14a_sc2', 'Scattershot', D, 3, 24, 14),
    b('t14a_gm', 'Gold Mine', C, 12, 6, 20, 80000), b('t14a_ec', 'Elixir Collector', C, 12, 34, 20, 78000),
    b('t14a_dd', 'Dark Elixir Drill', C, 9, 20, 32, 4000),
    b('t14a_gs', 'Gold Storage', S, 12, 12, 32), b('t14a_es', 'Elixir Storage', S, 12, 28, 32),
    b('t14a_ds', 'Dark Elixir Storage', S, 9, 20, 8),
  ]),
  base('npc_th14_2', 'Goblin Nexus', 14, 47, [1200000, 1150000, 9500], [
    b('t14b_th', 'Town Hall', O, 14, 22, 22), b('t14b_c1', 'Cannon', D, 20, 12, 12),
    b('t14b_at1', 'Archer Tower', D, 20, 32, 12), b('t14b_xb1', 'X-Bow', D, 8, 20, 24),
    b('t14b_xb2', 'X-Bow', D, 8, 24, 24), b('t14b_it1', 'Inferno Tower', D, 8, 18, 20),
    b('t14b_it2', 'Inferno Tower', D, 8, 26, 20), b('t14b_ea', 'Eagle Artillery', D, 5, 22, 28),
    b('t14b_sc1', 'Scattershot', D, 3, 18, 16), b('t14b_sc2', 'Scattershot', D, 3, 26, 16),
    b('t14b_gm', 'Gold Mine', C, 12, 8, 22, 95000), b('t14b_ec', 'Elixir Collector', C, 12, 36, 22, 92000),
    b('t14b_dd', 'Dark Elixir Drill', C, 9, 22, 34, 5000),
    b('t14b_gs', 'Gold Storage', S, 12, 14, 34), b('t14b_es', 'Elixir Storage', S, 12, 30, 34),
    b('t14b_ds', 'Dark Elixir Storage', S, 9, 22, 10),
  ]),
  base('npc_th14_3', 'Goblin Zenith', 14, 50, [1500000, 1450000, 11000], [
    b('t14c_th', 'Town Hall', O, 14, 21, 21), b('t14c_c1', 'Cannon', D, 20, 9, 9),
    b('t14c_at1', 'Archer Tower', D, 20, 33, 9), b('t14c_xb1', 'X-Bow', D, 8, 19, 23),
    b('t14c_xb2', 'X-Bow', D, 8, 23, 23), b('t14c_it1', 'Inferno Tower', D, 8, 15, 19),
    b('t14c_it2', 'Inferno Tower', D, 8, 27, 19), b('t14c_ea', 'Eagle Artillery', D, 5, 21, 27),
    b('t14c_sc1', 'Scattershot', D, 3, 15, 13), b('t14c_sc2', 'Scattershot', D, 3, 27, 13),
    b('t14c_gm', 'Gold Mine', C, 12, 5, 21, 110000), b('t14c_ec', 'Elixir Collector', C, 12, 37, 21, 108000),
    b('t14c_dd', 'Dark Elixir Drill', C, 9, 21, 35, 6000),
    b('t14c_gs', 'Gold Storage', S, 12, 11, 35), b('t14c_es', 'Elixir Storage', S, 12, 31, 35),
    b('t14c_ds', 'Dark Elixir Storage', S, 9, 21, 7),
  ]),
];

const th15Bases: NPCBase[] = [
  base('npc_th15_1', 'Goblin Oblivion', 15, 46, [1200000, 1150000, 10000], [
    b('t15a_th', 'Town Hall', O, 15, 20, 20), b('t15a_c1', 'Cannon', D, 20, 10, 10),
    b('t15a_at1', 'Archer Tower', D, 20, 30, 10), b('t15a_xb1', 'X-Bow', D, 8, 18, 22),
    b('t15a_xb2', 'X-Bow', D, 8, 22, 22), b('t15a_it1', 'Inferno Tower', D, 8, 16, 18),
    b('t15a_it2', 'Inferno Tower', D, 8, 24, 18), b('t15a_ea', 'Eagle Artillery', D, 5, 20, 26),
    b('t15a_sc1', 'Scattershot', D, 3, 16, 14), b('t15a_sc2', 'Scattershot', D, 3, 24, 14),
    b('t15a_gm', 'Gold Mine', C, 12, 6, 20, 100000), b('t15a_ec', 'Elixir Collector', C, 12, 34, 20, 98000),
    b('t15a_dd', 'Dark Elixir Drill', C, 9, 20, 32, 5000),
    b('t15a_gs', 'Gold Storage', S, 12, 12, 32), b('t15a_es', 'Elixir Storage', S, 12, 28, 32),
    b('t15a_ds', 'Dark Elixir Storage', S, 9, 20, 8),
  ]),
  base('npc_th15_2', 'Goblin Armageddon', 15, 49, [1600000, 1550000, 12000], [
    b('t15b_th', 'Town Hall', O, 15, 22, 22), b('t15b_c1', 'Cannon', D, 20, 12, 12),
    b('t15b_at1', 'Archer Tower', D, 20, 32, 12), b('t15b_xb1', 'X-Bow', D, 8, 20, 24),
    b('t15b_xb2', 'X-Bow', D, 8, 24, 24), b('t15b_it1', 'Inferno Tower', D, 8, 18, 20),
    b('t15b_it2', 'Inferno Tower', D, 8, 26, 20), b('t15b_ea', 'Eagle Artillery', D, 5, 22, 28),
    b('t15b_sc1', 'Scattershot', D, 3, 18, 16), b('t15b_sc2', 'Scattershot', D, 3, 26, 16),
    b('t15b_gm', 'Gold Mine', C, 12, 8, 22, 120000), b('t15b_ec', 'Elixir Collector', C, 12, 36, 22, 118000),
    b('t15b_dd', 'Dark Elixir Drill', C, 9, 22, 34, 6000),
    b('t15b_gs', 'Gold Storage', S, 12, 14, 34), b('t15b_es', 'Elixir Storage', S, 12, 30, 34),
    b('t15b_ds', 'Dark Elixir Storage', S, 9, 22, 10),
  ]),
  base('npc_th15_3', 'Goblin Eternal', 15, 52, [2000000, 1950000, 14000], [
    b('t15c_th', 'Town Hall', O, 15, 21, 21), b('t15c_c1', 'Cannon', D, 20, 9, 9),
    b('t15c_at1', 'Archer Tower', D, 20, 33, 9), b('t15c_xb1', 'X-Bow', D, 8, 19, 23),
    b('t15c_xb2', 'X-Bow', D, 8, 23, 23), b('t15c_it1', 'Inferno Tower', D, 8, 15, 19),
    b('t15c_it2', 'Inferno Tower', D, 8, 27, 19), b('t15c_ea', 'Eagle Artillery', D, 5, 21, 27),
    b('t15c_sc1', 'Scattershot', D, 3, 15, 13), b('t15c_sc2', 'Scattershot', D, 3, 27, 13),
    b('t15c_gm', 'Gold Mine', C, 12, 5, 21, 140000), b('t15c_ec', 'Elixir Collector', C, 12, 37, 21, 138000),
    b('t15c_dd', 'Dark Elixir Drill', C, 9, 21, 35, 7000),
    b('t15c_gs', 'Gold Storage', S, 12, 11, 35), b('t15c_es', 'Elixir Storage', S, 12, 31, 35),
    b('t15c_ds', 'Dark Elixir Storage', S, 9, 21, 7),
  ]),
];

export const npcBases: NPCBase[] = [
  ...th1Bases, ...th2Bases, ...th3Bases, ...th4Bases, ...th5Bases,
  ...th6Bases, ...th7Bases, ...th8Bases, ...th9Bases, ...th10Bases,
  ...th11Bases, ...th12Bases, ...th13Bases, ...th14Bases, ...th15Bases,
];

export function getNPCBasesForTH(thLevel: number): NPCBase[] {
  return npcBases.filter((base) => base.townHallLevel <= thLevel + 1);
}

export function getRandomNPCBase(thLevel: number): NPCBase | undefined {
  const available = getNPCBasesForTH(thLevel);
  if (available.length === 0) return undefined;
  return available[Math.floor(Math.random() * available.length)];
}
