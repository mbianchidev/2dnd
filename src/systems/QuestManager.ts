import { QuestData } from '../data/quests';

export class QuestManager {
    private activeQuests: Map<string, number> = new Map(); // questId -> stepIndex
    private completedQuests: Set<string> = new Set();

    startQuest(quest: QuestData) {
        if (!this.activeQuests.has(quest.id) && !this.completedQuests.has(quest.id)) {
            this.activeQuests.set(quest.id, 0);
            console.log(`Started quest: ${quest.title}`);
        }
    }

    advanceQuest(questId: string) {
        if (this.activeQuests.has(questId)) {
            const currentStep = this.activeQuests.get(questId)!;
            this.activeQuests.set(questId, currentStep + 1);
            console.log(`Advanced quest: ${questId} to step ${currentStep + 1}`);
        }
    }

    completeQuest(questId: string) {
        if (this.activeQuests.has(questId)) {
            this.activeQuests.delete(questId);
            this.completedQuests.add(questId);
            console.log(`Completed quest: ${questId}`);
        }
    }
}
