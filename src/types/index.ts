/**
 * Core game type definitions for 2DND
 */

// =============================================================================
// DICE SYSTEM (D&D-style)
// =============================================================================

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

export interface DiceRoll {
  dice: DieType
  count: number
  modifier?: number
}

export interface RollResult {
  rolls: number[]
  total: number
  critical?: boolean
  fumble?: boolean
}

// =============================================================================
// STATS & ATTRIBUTES
// =============================================================================

export interface Stats {
  maxHp: number
  hp: number
  maxMp?: number
  mp?: number
  attack: number
  defense: number
  speed: number
  magic?: number
  magicDefense?: number
  luck?: number
}

export interface Attributes {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

// =============================================================================
// STATUS EFFECTS
// =============================================================================

export type StatusType =
  | 'poison'
  | 'paralysis'
  | 'sleep'
  | 'confusion'
  | 'silence'
  | 'blind'
  | 'regen'
  | 'shield'
  | 'attack_up'
  | 'attack_down'
  | 'defense_up'
  | 'defense_down'
  | 'speed_up'
  | 'speed_down'

export interface StatusEffect {
  type: StatusType
  duration: number // turns remaining (-1 = until cured)
  potency?: number // for damage/heal over time
  source?: string // skill/item that applied it
}

// =============================================================================
// ACTORS (Players & Enemies)
// =============================================================================

export interface ActorData {
  id: string
  name: string
  stats: Stats
  attributes?: Attributes
  skills: string[]
  equipment?: EquipmentSlots
  statusEffects?: StatusEffect[]
  spriteKey?: string
  portrait?: string
}

export interface MonsterData extends ActorData {
  level: number
  experienceReward: number
  goldReward: DiceRoll | number
  dropTable?: DropEntry[]
  behavior?: AIBehavior
  isBoss?: boolean
}

export interface DropEntry {
  itemId: string
  chance: number // 0-1
  quantity?: DiceRoll | number
}

export type AIBehavior = 'aggressive' | 'defensive' | 'support' | 'random' | 'scripted'

// =============================================================================
// EQUIPMENT
// =============================================================================

export type EquipmentSlot = 'weapon' | 'shield' | 'head' | 'body' | 'accessory'

export type EquipmentSlots = Partial<Record<EquipmentSlot, string>>

// =============================================================================
// ITEMS
// =============================================================================

export type ItemType = 'consumable' | 'equipment' | 'key' | 'material'
export type TargetType = 'self' | 'single_ally' | 'single_enemy' | 'all_allies' | 'all_enemies' | 'all'

export interface ItemData {
  id: string
  name: string
  description: string
  type: ItemType
  stackable: boolean
  maxStack?: number
  value: number // gold value
  usable: boolean
  targetType?: TargetType
  effect?: ItemEffect
  equipSlot?: EquipmentSlot
  statBonus?: Partial<Stats>
}

export interface ItemEffect {
  healHp?: number | DiceRoll
  healMp?: number | DiceRoll
  damage?: number | DiceRoll
  applyStatus?: { type: StatusType; duration: number; potency?: number }
  removeStatus?: StatusType[]
  revive?: boolean
  reviveHpPercent?: number
}

export interface InventoryItem {
  itemId: string
  quantity: number
}

// =============================================================================
// SKILLS
// =============================================================================

export type SkillType = 'physical' | 'magical' | 'support' | 'special'
export type DamageType = 'physical' | 'magical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'dark' | 'none'

export interface SkillData {
  id: string
  name: string
  description: string
  type: SkillType
  mpCost: number
  targetType: TargetType
  damageType: DamageType
  power?: number | DiceRoll
  accuracy?: number // 0-100, default 100
  criticalChance?: number // 0-100
  effects?: SkillEffect[]
  animation?: string
}

export interface SkillEffect {
  type: 'damage' | 'heal' | 'status' | 'stat_mod'
  value?: number | DiceRoll
  status?: { type: StatusType; duration: number; chance: number }
  statMod?: { stat: keyof Stats; modifier: number; duration: number }
}

// =============================================================================
// QUESTS
// =============================================================================

export type QuestStatus = 'unknown' | 'available' | 'active' | 'completed' | 'failed'
export type ObjectiveType = 'defeat' | 'collect' | 'talk' | 'reach' | 'escort'

export interface QuestObjective {
  id: string
  type: ObjectiveType
  description: string
  targetId?: string // monster/item/npc/location id
  targetCount?: number
  currentCount?: number
  completed: boolean
  optional?: boolean
}

export interface QuestReward {
  gold?: number
  experience?: number
  items?: { itemId: string; quantity: number }[]
}

export interface QuestData {
  id: string
  name: string
  description: string
  objectives: QuestObjective[]
  rewards: QuestReward
  prerequisiteQuests?: string[]
  level?: number // recommended level
}

// =============================================================================
// DIALOG
// =============================================================================

export interface DialogChoice {
  text: string
  nextNodeId?: string
  condition?: string // expression to evaluate
  action?: string // action to trigger
}

export interface DialogNode {
  id: string
  speaker?: string
  portrait?: string
  text: string
  choices?: DialogChoice[]
  nextNodeId?: string // for linear dialog
  action?: string // trigger action after displaying
}

export interface DialogData {
  id: string
  startNodeId: string
  nodes: Record<string, DialogNode>
}

// =============================================================================
// NPCs
// =============================================================================

export type NPCType = 'quest_giver' | 'merchant' | 'innkeeper' | 'save_point' | 'generic'

export interface NPCData {
  id: string
  name: string
  type: NPCType
  spriteKey: string
  dialogId?: string
  shopInventory?: string[] // item ids for merchants
  quests?: string[] // quest ids they can give
  position?: { x: number; y: number; map: string }
}

// =============================================================================
// MAPS & ENCOUNTERS
// =============================================================================

export interface EncounterZone {
  id: string
  bounds: { x: number; y: number; width: number; height: number }
  encounterRate: number // 0-100 per step
  possibleEncounters: EncounterEntry[]
}

export interface EncounterEntry {
  monsters: string[] // monster ids
  weight: number // relative probability
  minLevel?: number
  maxLevel?: number
}

export interface MapData {
  id: string
  name: string
  tilemapKey: string
  tilesetKey: string
  encounterZones?: EncounterZone[]
  npcs?: string[]
  connections?: MapConnection[]
  bgmKey?: string
}

export interface MapConnection {
  targetMapId: string
  sourceArea: { x: number; y: number; width: number; height: number }
  targetPosition: { x: number; y: number }
}

// =============================================================================
// SAVE DATA
// =============================================================================

export interface SaveData {
  version: string
  timestamp: number
  playTime: number // in seconds
  party: PartyMemberSave[]
  inventory: InventoryItem[]
  gold: number
  currentMap: string
  position: { x: number; y: number }
  quests: QuestProgress[]
  flags: Record<string, boolean | number | string>
  settings: GameSettings
}

export interface PartyMemberSave {
  actorId: string
  stats: Stats
  attributes?: Attributes
  equipment: EquipmentSlots
  statusEffects: StatusEffect[]
  experience: number
  level: number
}

export interface QuestProgress {
  questId: string
  status: QuestStatus
  objectives: { id: string; currentCount: number; completed: boolean }[]
}

export interface GameSettings {
  musicVolume: number
  sfxVolume: number
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant'
  battleAnimations: boolean
  screenShake: boolean
}

// =============================================================================
// BATTLE SYSTEM
// =============================================================================

export type BattleActionType = 'attack' | 'skill' | 'item' | 'defend' | 'flee'

export interface BattleAction {
  type: BattleActionType
  actorId: string
  targetIds?: string[]
  skillId?: string
  itemId?: string
}

export interface BattlerState {
  actor: ActorData | MonsterData
  isPlayer: boolean
  isDefending: boolean
  turnOrder: number
}

export interface BattleResult {
  victory: boolean
  fled: boolean
  experienceGained: number
  goldGained: number
  itemsDropped: { itemId: string; quantity: number }[]
  defeatedMonsters: string[]
}

// =============================================================================
// EVENTS
// =============================================================================

export type GameEventType =
  | 'battle_start'
  | 'battle_end'
  | 'level_up'
  | 'item_obtained'
  | 'quest_started'
  | 'quest_completed'
  | 'quest_objective_updated'
  | 'map_changed'
  | 'dialog_started'
  | 'dialog_ended'
  | 'save_game'
  | 'load_game'

export interface GameEvent {
  type: GameEventType
  data?: Record<string, unknown>
  timestamp: number
}
