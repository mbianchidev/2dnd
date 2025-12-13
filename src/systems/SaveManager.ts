export interface SaveData {
    version: number;
    player: {
        hp: number;
        maxHp: number;
        position: { x: number, y: number };
    };
    quests: {
        active: [string, number][];
        completed: string[];
    };
}

export class SaveManager {
    private static readonly SAVE_KEY = '2dnd_save';
    private static readonly VERSION = 1;

    static save(data: SaveData) {
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
        console.log('Game saved.');
    }

    static load(): SaveData | null {
        const json = localStorage.getItem(this.SAVE_KEY);
        if (!json) return null;

        try {
            const data = JSON.parse(json) as SaveData;
            if (data.version !== this.VERSION) {
                console.warn('Save version mismatch. Migration needed.');
                // Implement migration logic here
            }
            console.log('Game loaded.');
            return data;
        } catch (e) {
            console.error('Failed to load save:', e);
            return null;
        }
    }

    static hasSave(): boolean {
        return !!localStorage.getItem(this.SAVE_KEY);
    }
}
