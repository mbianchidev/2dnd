export interface Combatant {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  sp: number; // Skill points / Mana
  maxSp: number;
  stats: {
    str: number;
    def: number;
    spd: number;
  };
  isPlayer: boolean;
}

export interface Action {
  name: string;
  type: 'attack' | 'skill' | 'item';
  target: 'single' | 'all';
  execute: (user: Combatant, target: Combatant) => void;
}
