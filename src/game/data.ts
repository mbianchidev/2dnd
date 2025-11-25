import { Monster, Item, Spell, BiomeType } from '../types/game';

// Monster templates
export const MONSTERS: Record<string, Monster> = {
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    health: 7,
    maxHealth: 7,
    armorClass: 15,
    attackBonus: 4,
    damage: '1d6+2',
    experience: 50,
    gold: 10,
  },
  orc: {
    id: 'orc',
    name: 'Orc',
    health: 15,
    maxHealth: 15,
    armorClass: 13,
    attackBonus: 5,
    damage: '1d12+3',
    experience: 100,
    gold: 25,
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    health: 13,
    maxHealth: 13,
    armorClass: 13,
    attackBonus: 4,
    damage: '1d6+2',
    experience: 50,
    gold: 5,
  },
  dragon: {
    id: 'dragon',
    name: 'Young Dragon',
    health: 178,
    maxHealth: 178,
    armorClass: 18,
    attackBonus: 10,
    damage: '2d10+6',
    experience: 5000,
    gold: 500,
  },
};

// Spells by level
export const SPELLS: Spell[] = [
  {
    id: 'magic-missile',
    name: 'Magic Missile',
    level: 1,
    manaCost: 10,
    damage: '3d4+3',
    description: 'Three bolts of magical force',
  },
  {
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    manaCost: 10,
    healing: '1d8+4',
    description: 'Heal yourself or an ally',
  },
  {
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    manaCost: 30,
    damage: '8d6',
    description: 'A bright streak flashes into a roaring ball of flame',
  },
];

// Items available in shops
export const ITEMS: Record<string, Item> = {
  'health-potion': {
    id: 'health-potion',
    name: 'Health Potion',
    description: 'Restores 2d4+2 HP',
    type: 'potion',
    value: 50,
    effect: '2d4+2',
  },
  'mana-potion': {
    id: 'mana-potion',
    name: 'Mana Potion',
    description: 'Restores 1d8 MP',
    type: 'potion',
    value: 50,
    effect: '1d8',
  },
  'iron-sword': {
    id: 'iron-sword',
    name: 'Iron Sword',
    description: '+2 to attack rolls, 1d8 damage',
    type: 'weapon',
    value: 100,
  },
  'leather-armor': {
    id: 'leather-armor',
    name: 'Leather Armor',
    description: 'AC 11 + Dex modifier',
    type: 'armor',
    value: 100,
  },
};

// Biome definitions
export const BIOMES: Record<string, BiomeType> = {
  grass: {
    name: 'Grassland',
    encounterRate: 0.02,
    monsterTypes: ['goblin'],
    tileColor: 0x4CAF50,
  },
  forest: {
    name: 'Forest',
    encounterRate: 0.03,
    monsterTypes: ['goblin', 'orc'],
    tileColor: 0x2E7D32,
  },
  mountain: {
    name: 'Mountain',
    encounterRate: 0.04,
    monsterTypes: ['orc', 'skeleton'],
    tileColor: 0x757575,
  },
};
