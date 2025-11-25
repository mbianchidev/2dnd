import { Combatant } from '../types/Combat';

export type MonsterData = Omit<Combatant, 'isPlayer'> & {
    xpReward: number;
    goldReward: number;
};

export const Monsters: Record<string, MonsterData> = {
    slime: {
        id: 'slime',
        name: 'Slime',
        hp: 20,
        maxHp: 20,
        sp: 0,
        maxSp: 0,
        stats: { str: 5, def: 2, spd: 5 },
        xpReward: 10,
        goldReward: 5
    },
    goblin: {
        id: 'goblin',
        name: 'Goblin',
        hp: 40,
        maxHp: 40,
        sp: 0,
        maxSp: 0,
        stats: { str: 8, def: 4, spd: 8 },
        xpReward: 25,
        goldReward: 15
    }
};
