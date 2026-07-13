export const TRAP_TYPES = [
  "spikePit",
  "poisonDarts",
  "fallingRocks",
  "alarm",
  "hiddenFloor",
  "necroticRune",
  "frostBurst",
  "flameJet",
] as const;

export type TrapType = (typeof TRAP_TYPES)[number];

export const TRAP_STATES = [
  "missed",
  "detected",
  "disarmed",
  "triggered",
] as const;

export type TrapState = (typeof TRAP_STATES)[number];
export type TrapAbility = "dexterity" | "intelligence";
export type TrapDie = 4 | 6 | 8 | 10 | 12;
export type TrapStatusEffect =
  | "poison"
  | "burn"
  | "freeze"
  | "stunned"
  | "frightened"
  | "prone";

export interface TrapDamage {
  count: number;
  sides: TrapDie;
}

export interface TrapDefinition {
  type: TrapType;
  name: string;
  cue: string;
  detectionAbility: TrapAbility;
  disarmAbility: TrapAbility;
  detectionDC: number;
  disarmDC: number;
  rewardXp: number;
  color: number;
  damage?: TrapDamage;
  mpLoss?: number;
  statusEffect?: TrapStatusEffect;
  startsEncounter?: boolean;
  dropsLevel?: boolean;
}

export interface DungeonTrapProfile {
  types: TrapType[];
  thematicType: TrapType;
  trapsPerLevel: number;
  difficultyModifier: number;
}

export interface DungeonTrap {
  id: string;
  dungeonId: string;
  level: number;
  x: number;
  y: number;
  type: TrapType;
  detectionDC: number;
  disarmDC: number;
  rewardXp: number;
  protectsTreasure: boolean;
}
