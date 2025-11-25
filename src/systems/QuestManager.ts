import type { QuestProgress, QuestStatus } from '../types'
import { getQuest } from '../data/quests'

type QuestEventCallback = (event: string, data: Record<string, unknown>) => void

/**
 * Quest manager for tracking quest progress
 */
export class QuestManager {
  private activeQuests: Map<string, QuestProgress> = new Map()
  private completedQuests: Set<string> = new Set()
  private failedQuests: Set<string> = new Set()
  private callback: QuestEventCallback

  constructor(callback: QuestEventCallback) {
    this.callback = callback
  }

  /**
   * Start a new quest
   */
  startQuest(questId: string): boolean {
    if (this.activeQuests.has(questId) || this.completedQuests.has(questId)) {
      return false
    }

    const questData = getQuest(questId)

    // Check prerequisites
    if (questData.prerequisiteQuests) {
      for (const prereq of questData.prerequisiteQuests) {
        if (!this.completedQuests.has(prereq)) {
          return false
        }
      }
    }

    const progress: QuestProgress = {
      questId,
      status: 'active',
      objectives: questData.objectives.map((obj) => ({
        id: obj.id,
        currentCount: 0,
        completed: false,
      })),
    }

    this.activeQuests.set(questId, progress)
    this.callback('quest_started', { questId, quest: questData })

    return true
  }

  /**
   * Update quest objective progress
   */
  updateObjective(questId: string, objectiveId: string, count: number): void {
    const progress = this.activeQuests.get(questId)
    if (!progress) return

    const questData = getQuest(questId)
    const objectiveData = questData.objectives.find((o) => o.id === objectiveId)
    const objectiveProgress = progress.objectives.find((o) => o.id === objectiveId)

    if (!objectiveData || !objectiveProgress || objectiveProgress.completed) return

    objectiveProgress.currentCount = count

    // Check if objective is complete
    if (objectiveData.targetCount && count >= objectiveData.targetCount) {
      objectiveProgress.completed = true
      this.callback('objective_completed', {
        questId,
        objectiveId,
        objective: objectiveData,
      })
    }

    // Check if all required objectives are complete
    this.checkQuestCompletion(questId)
  }

  /**
   * Increment objective count (for defeat/collect objectives)
   */
  incrementObjective(questId: string, objectiveId: string, amount = 1): void {
    const progress = this.activeQuests.get(questId)
    if (!progress) return

    const objectiveProgress = progress.objectives.find((o) => o.id === objectiveId)
    if (!objectiveProgress) return

    this.updateObjective(questId, objectiveId, objectiveProgress.currentCount + amount)
  }

  /**
   * Mark an objective as complete (for talk/reach objectives)
   */
  completeObjective(questId: string, objectiveId: string): void {
    const progress = this.activeQuests.get(questId)
    if (!progress) return

    const questData = getQuest(questId)
    const objectiveData = questData.objectives.find((o) => o.id === objectiveId)
    const objectiveProgress = progress.objectives.find((o) => o.id === objectiveId)

    if (!objectiveData || !objectiveProgress || objectiveProgress.completed) return

    objectiveProgress.completed = true
    this.callback('objective_completed', {
      questId,
      objectiveId,
      objective: objectiveData,
    })

    this.checkQuestCompletion(questId)
  }

  /**
   * Check if quest can be completed
   */
  private checkQuestCompletion(questId: string): void {
    const progress = this.activeQuests.get(questId)
    if (!progress) return

    const questData = getQuest(questId)

    // Check if all required objectives are complete
    const allRequired = questData.objectives
      .filter((o) => !o.optional)
      .every((o) => {
        const objProgress = progress.objectives.find((p) => p.id === o.id)
        return objProgress?.completed
      })

    if (allRequired) {
      this.completeQuest(questId)
    }
  }

  /**
   * Complete a quest and grant rewards
   */
  private completeQuest(questId: string): void {
    const progress = this.activeQuests.get(questId)
    if (!progress) return

    const questData = getQuest(questId)

    this.activeQuests.delete(questId)
    this.completedQuests.add(questId)
    progress.status = 'completed'

    this.callback('quest_completed', {
      questId,
      quest: questData,
      rewards: questData.rewards,
    })
  }

  /**
   * Fail a quest
   */
  failQuest(questId: string): void {
    const progress = this.activeQuests.get(questId)
    if (!progress) return

    this.activeQuests.delete(questId)
    this.failedQuests.add(questId)
    progress.status = 'failed'

    this.callback('quest_failed', { questId })
  }

  /**
   * Get quest status
   */
  getQuestStatus(questId: string): QuestStatus {
    if (this.activeQuests.has(questId)) return 'active'
    if (this.completedQuests.has(questId)) return 'completed'
    if (this.failedQuests.has(questId)) return 'failed'

    // Check if quest is available
    try {
      const questData = getQuest(questId)
      if (questData.prerequisiteQuests) {
        const hasPrereqs = questData.prerequisiteQuests.every((p) => this.completedQuests.has(p))
        return hasPrereqs ? 'available' : 'unknown'
      }
      return 'available'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Get progress for a specific quest
   */
  getQuestProgress(questId: string): QuestProgress | null {
    return this.activeQuests.get(questId) || null
  }

  /**
   * Get all active quests
   */
  getActiveQuests(): QuestProgress[] {
    return Array.from(this.activeQuests.values())
  }

  /**
   * Get all completed quest IDs
   */
  getCompletedQuests(): string[] {
    return Array.from(this.completedQuests)
  }

  /**
   * Process a monster defeat (update relevant quest objectives)
   */
  onMonsterDefeated(monsterId: string): void {
    for (const [questId] of this.activeQuests) {
      const questData = getQuest(questId)

      for (const objective of questData.objectives) {
        if (objective.type === 'defeat' && objective.targetId === monsterId) {
          this.incrementObjective(questId, objective.id)
        }
      }
    }
  }

  /**
   * Process an item collection (update relevant quest objectives)
   */
  onItemCollected(itemId: string): void {
    for (const [questId] of this.activeQuests) {
      const questData = getQuest(questId)

      for (const objective of questData.objectives) {
        if (objective.type === 'collect' && objective.targetId === itemId) {
          this.incrementObjective(questId, objective.id)
        }
      }
    }
  }

  /**
   * Process talking to an NPC (update relevant quest objectives)
   */
  onNPCTalked(npcId: string): void {
    for (const [questId] of this.activeQuests) {
      const questData = getQuest(questId)

      for (const objective of questData.objectives) {
        if (objective.type === 'talk' && objective.targetId === npcId) {
          this.completeObjective(questId, objective.id)
        }
      }
    }
  }

  /**
   * Process reaching a location (update relevant quest objectives)
   */
  onLocationReached(locationId: string): void {
    for (const [questId] of this.activeQuests) {
      const questData = getQuest(questId)

      for (const objective of questData.objectives) {
        if (objective.type === 'reach' && objective.targetId === locationId) {
          this.completeObjective(questId, objective.id)
        }
      }
    }
  }

  /**
   * Export state for saving
   */
  exportState(): { active: QuestProgress[]; completed: string[]; failed: string[] } {
    return {
      active: Array.from(this.activeQuests.values()),
      completed: Array.from(this.completedQuests),
      failed: Array.from(this.failedQuests),
    }
  }

  /**
   * Import state from save
   */
  importState(state: { active: QuestProgress[]; completed: string[]; failed: string[] }): void {
    this.activeQuests.clear()
    this.completedQuests.clear()
    this.failedQuests.clear()

    for (const progress of state.active) {
      this.activeQuests.set(progress.questId, progress)
    }
    for (const questId of state.completed) {
      this.completedQuests.add(questId)
    }
    for (const questId of state.failed) {
      this.failedQuests.add(questId)
    }
  }
}
