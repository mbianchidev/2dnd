export interface SkillData {
    id: string;
    name: string;
    spCost: number;
    power: number;
}

export const Skills: Record<string, SkillData> = {
    fireball: {
        id: 'fireball',
        name: 'Fireball',
        spCost: 5,
        power: 20
    }
};
