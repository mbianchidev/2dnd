// Core game types

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  level: number;
  experience: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  gold: number;
  inventory: Item[];
  equipment: Equipment;
  spells: Spell[];
}

export interface Monster {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  armorClass: number;
  attackBonus: number;
  damage: string; // e.g., "1d8+2"
  experience: number;
  gold: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'misc';
  value: number;
  effect?: string;
}

export interface Equipment {
  weapon?: Item;
  armor?: Item;
  accessory?: Item;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  manaCost: number;
  damage?: string; // e.g., "2d6"
  healing?: string; // e.g., "1d8+5"
  description: string;
}

export interface BiomeType {
  name: string;
  encounterRate: number;
  monsterTypes: string[];
  tileColor: number;
}

export interface Location {
  type: 'city' | 'dungeon' | 'boss';
  name: string;
  position: Position;
  description: string;
}

export interface BattleState {
  active: boolean;
  monster?: Monster;
  playerTurn: boolean;
  battleLog: string[];
}

export interface GameState {
  player: Player;
  currentMap: string;
  locations: Location[];
  battleState: BattleState;
  gameStarted: boolean;
}
