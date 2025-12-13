import { Monsters } from './monsters';
import { Items } from './items';
import { Skills } from './skills';
import { Quests } from './quests';

export class ContentRegistry {
    static getMonster(id: string) {
        return Monsters[id];
    }
    static getItem(id: string) {
        return Items[id];
    }
    static getSkill(id: string) {
        return Skills[id];
    }
    static getQuest(id: string) {
        return Quests[id];
    }
}
