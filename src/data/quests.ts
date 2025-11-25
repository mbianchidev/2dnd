import type { QuestData } from '../types'

export const quests: Record<string, QuestData> = {
  tutorial_slimes: {
    id: 'tutorial_slimes',
    name: 'Pest Control',
    description: 'The village elder has asked you to clear the slimes from the nearby fields.',
    level: 1,
    objectives: [
      {
        id: 'defeat_slimes',
        type: 'defeat',
        description: 'Defeat 3 Slimes',
        targetId: 'slime',
        targetCount: 3,
        currentCount: 0,
        completed: false,
      },
      {
        id: 'return_elder',
        type: 'talk',
        description: 'Return to the Village Elder',
        targetId: 'npc_elder',
        completed: false,
      },
    ],
    rewards: {
      gold: 50,
      experience: 25,
      items: [
        { itemId: 'potion', quantity: 2 },
        { itemId: 'herb', quantity: 3 },
      ],
    },
  },

  goblin_menace: {
    id: 'goblin_menace',
    name: 'The Goblin Menace',
    description: 'Goblins have been raiding the trade routes. Find their hideout and deal with them.',
    level: 3,
    prerequisiteQuests: ['tutorial_slimes'],
    objectives: [
      {
        id: 'defeat_goblins',
        type: 'defeat',
        description: 'Defeat 5 Goblins',
        targetId: 'goblin',
        targetCount: 5,
        currentCount: 0,
        completed: false,
      },
      {
        id: 'find_hideout',
        type: 'reach',
        description: 'Find the Goblin Hideout',
        targetId: 'map_goblin_cave',
        completed: false,
      },
      {
        id: 'defeat_chief',
        type: 'defeat',
        description: 'Defeat the Goblin Chief',
        targetId: 'goblin_chief',
        targetCount: 1,
        currentCount: 0,
        completed: false,
      },
    ],
    rewards: {
      gold: 200,
      experience: 100,
      items: [{ itemId: 'iron_sword', quantity: 1 }],
    },
  },

  collect_herbs: {
    id: 'collect_herbs',
    name: 'Herbal Medicine',
    description: 'The healer needs herbs to make medicine. Collect some from the forest.',
    level: 1,
    objectives: [
      {
        id: 'collect_herbs',
        type: 'collect',
        description: 'Collect 5 Herbs',
        targetId: 'herb',
        targetCount: 5,
        currentCount: 0,
        completed: false,
      },
      {
        id: 'deliver_herbs',
        type: 'talk',
        description: 'Deliver the herbs to the Healer',
        targetId: 'npc_healer',
        completed: false,
      },
    ],
    rewards: {
      gold: 30,
      experience: 15,
      items: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'antidote', quantity: 2 },
      ],
    },
  },

  spider_silk_quest: {
    id: 'spider_silk_quest',
    name: 'Silk Trade',
    description: 'The tailor needs spider silk for a special commission.',
    level: 4,
    objectives: [
      {
        id: 'collect_silk',
        type: 'collect',
        description: 'Collect 3 Spider Silk',
        targetId: 'spider_silk',
        targetCount: 3,
        currentCount: 0,
        completed: false,
      },
    ],
    rewards: {
      gold: 150,
      experience: 50,
      items: [{ itemId: 'speed_boots', quantity: 1 }],
    },
  },

  dungeon_exploration: {
    id: 'dungeon_exploration',
    name: 'Into the Depths',
    description: 'Explore the ancient dungeon and discover its secrets.',
    level: 5,
    prerequisiteQuests: ['goblin_menace'],
    objectives: [
      {
        id: 'find_key',
        type: 'collect',
        description: 'Find the Dungeon Key',
        targetId: 'dungeon_key',
        targetCount: 1,
        currentCount: 0,
        completed: false,
      },
      {
        id: 'reach_depths',
        type: 'reach',
        description: 'Reach the deepest floor',
        targetId: 'map_dungeon_b3',
        completed: false,
      },
      {
        id: 'defeat_boss',
        type: 'defeat',
        description: 'Defeat the Dungeon Guardian',
        targetId: 'dungeon_guardian',
        targetCount: 1,
        currentCount: 0,
        completed: false,
        optional: true,
      },
    ],
    rewards: {
      gold: 500,
      experience: 300,
      items: [{ itemId: 'steel_sword', quantity: 1 }],
    },
  },
}

export function getQuest(id: string): QuestData {
  const quest = quests[id]
  if (!quest) {
    throw new Error(`Quest not found: ${id}`)
  }
  // Return a deep copy to allow independent quest state
  return {
    ...quest,
    objectives: quest.objectives.map((obj) => ({ ...obj })),
    rewards: {
      ...quest.rewards,
      items: quest.rewards.items?.map((item) => ({ ...item })),
    },
  }
}

export function getQuestsByLevel(maxLevel: number): QuestData[] {
  return Object.values(quests).filter((q) => (q.level ?? 1) <= maxLevel)
}

export function getAvailableQuests(completedQuests: string[], currentLevel: number): QuestData[] {
  return Object.values(quests).filter((quest) => {
    // Check if already completed
    if (completedQuests.includes(quest.id)) return false

    // Check level requirement
    if ((quest.level ?? 1) > currentLevel) return false

    // Check prerequisite quests
    if (quest.prerequisiteQuests) {
      const hasAllPrereqs = quest.prerequisiteQuests.every((prereq) => completedQuests.includes(prereq))
      if (!hasAllPrereqs) return false
    }

    return true
  })
}
