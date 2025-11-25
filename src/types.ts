export interface StatBlock {
  maxHp: number
  hp: number
  attack: number
  defense: number
  speed: number
}

export interface Skill {
  id: string
  name: string
  description?: string
  power: number // multiplier for attack
  cost?: number // MP cost (future)
}

export interface ActorData {
  id: string
  name: string
  stats: StatBlock
  skills: string[]
}

export interface MonsterData extends ActorData {
  xpReward: number
  goldReward: number
  loot?: string[]
}

export interface ItemData {
  id: string
  name: string
  description?: string
  type: 'consumable' | 'equipment'
  effect?: {
    heal?: number
  }
}

export interface BattleParticipant {
  id: string
  name: string
  stats: StatBlock
  skills: Skill[]
  isPlayer: boolean
}

export interface BattleLogEntry {
  message: string
}

export interface BattleResult {
  winner: 'player' | 'enemy'
  log: BattleLogEntry[]
  remainingHp: number
}
