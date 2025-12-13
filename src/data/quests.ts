export interface QuestData {
    id: string;
    title: string;
    description: string;
    steps: string[];
}

export const Quests: Record<string, QuestData> = {
    intro: {
        id: 'intro',
        title: 'The Beginning',
        description: 'Talk to the village elder.',
        steps: ['talk_elder', 'kill_slimes']
    }
};
